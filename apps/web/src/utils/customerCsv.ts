import type { NewCustomerPayload } from '@/features/customers/types/customer.types'

export interface CsvParseResult {
  rows: NewCustomerPayload[]
  rowLines: number[]
  errors: Array<{ line: number; reason: string }>
}

/**
 * Parses customers CSV with fixed column order:
 * name, email, country, totalTransactions, totalAmountSpent, lastActivityDate, status.
 * An optional header row (containing "email") is skipped. Rows are returned
 * with line numbers so import errors can point back to the source row.
 */
export function parseCustomersCsv(text: string): CsvParseResult {
  const result: CsvParseResult = { rows: [], rowLines: [], errors: [] }
  const lines = text.split(/\r?\n/)

  let dataIndex = 0
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (line.length === 0) return

    const cells = line.split(',').map((cell) => cell.trim())
    const isFirstContentRow = dataIndex === 0
    if (isFirstContentRow && cells.some((cell) => cell.toLowerCase() === 'email')) {
      dataIndex += 1
      return
    }
    dataIndex += 1

    const [name = '', email = '', country = '', transactions = '', amount = '', date = '', status = ''] = cells
    result.rows.push({
      name,
      email,
      country,
      totalTransactions: Number(transactions),
      totalAmountSpent: Number(amount),
      lastActivityDate: date.length > 0 ? date : new Date().toISOString().slice(0, 10),
      status: (status.length > 0 ? status : 'active') as NewCustomerPayload['status'],
    })
    result.rowLines.push(index + 1)
  })

  return result
}
