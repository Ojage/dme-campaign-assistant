import type { NewCustomerPayload } from '@/features/customers/types/customer.types'

export interface CsvParseResult {
  rows: NewCustomerPayload[]
  rowLines: number[]
}

function isBlankRecord(record: string[]): boolean {
  return record.every((cell) => cell === '')
}

/**
 * Splits CSV text into records of fields, honouring RFC 4180 quoting:
 * fields wrapped in double quotes may contain commas, newlines, and a literal
 * quote written as `""`. Everything outside quotes is kept verbatim apart from
 * the delimiter and the `\r` of a `\r\n` line ending. This replaces the old
 * `line.split(',')`, which mangled any quoted field containing a comma.
 */
function parseCsvRecords(text: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        const next = text[i + 1]
        if (next === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else if (char === '"' && field === '') {
      inQuotes = true
    } else if (char === ',') {
      record.push(field)
      field = ''
    } else if (char === '\n') {
      record.push(field)
      field = ''
      records.push(record)
      record = []
    } else if (char === '\r') {
      // Ignored outside quotes; a `\r\n` line ending is completed by the `\n`.
    } else {
      field += char
    }
  }

  record.push(field)
  records.push(record)
  return records
}

/** Maps a free-form status cell onto the three allowed values; defaults to `active`. */
function normalizeStatus(cell: string): NewCustomerPayload['status'] {
  switch (cell.trim().toLowerCase()) {
    case 'inactive':
      return 'inactive'
    case 'churned':
      return 'churned'
    default:
      return 'active'
  }
}

/**
 * Parses customers CSV with fixed column order:
 * name, email, country, totalTransactions, totalAmountSpent, lastActivityDate, status.
 * An optional header row (containing "email") is skipped. Rows are returned
 * with line numbers so import errors can point back to the source row.
 */
export function parseCustomersCsv(text: string): CsvParseResult {
  const rows: NewCustomerPayload[] = []
  const rowLines: number[] = []

  let dataIndex = 0
  parseCsvRecords(text).forEach((rawRecord, index) => {
    const record = rawRecord.map((cell) => cell.trim())
    if (isBlankRecord(record)) {
      // Blank lines carry no data but still occupy a file line; the header may
      // also follow a leading blank line, so they are skipped rather than
      // treated as a customer row.
      return
    }
    if (dataIndex === 0 && record.some((cell) => cell.toLowerCase() === 'email')) {
      dataIndex += 1
      return
    }
    dataIndex += 1

    const [name = '', email = '', country = '', transactions = '', amount = '', date = '', status = ''] = record
    rows.push({
      name,
      email,
      country,
      totalTransactions: Number(transactions),
      totalAmountSpent: Number(amount),
      lastActivityDate: date.length > 0 ? date : new Date().toISOString().slice(0, 10),
      status: normalizeStatus(status),
    })
    rowLines.push(index + 1)
  })

  return { rows, rowLines }
}