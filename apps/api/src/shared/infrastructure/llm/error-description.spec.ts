import { describeException } from './error-description'

describe('describeException', () => {
  it('joins the name, code and message of a single error', () => {
    const err = new Error('reset by peer') as Error & { code?: string }
    err.name = 'ConnectTimeoutError'
    err.code = 'UND_ERR_CONNECT_TIMEOUT'

    expect(describeException(err)).toBe('ConnectTimeoutError (UND_ERR_CONNECT_TIMEOUT: reset by peer)')
  })

  it('unfolds the fetch wrapper when the real fault is in the cause chain', () => {
    const connectTimedOut = new Error('operation timed out')
    connectTimedOut.name = 'ConnectTimeoutError'
    const transport = new TypeError('fetch failed')
    transport.cause = connectTimedOut

    expect(describeException(transport)).toBe('TypeError: fetch failed → ConnectTimeoutError: operation timed out')
  })

  it('expands AggregateError batches', () => {
    const a = new Error('connect ECONNREFUSED 198.51.100.1:443' as string)
    a.name = 'ConnectTimeoutError'
    const batch = new AggregateError([a, new RangeError('boom')], 'net')
    const transport = Object.assign(new TypeError('fetch failed'), { cause: batch })

    const description = describeException(transport)

    expect(description).toContain('ConnectTimeoutError: connect ECONNREFUSED 198.51.100.1:443')
    expect(description).toContain('RangeError: boom')
    expect(description).toContain('AggregateError')
  })

  it('does not loop forever on a cyclic cause', () => {
    const err = { name: 'Error', message: 'self' } as { name: string; message: string; cause?: unknown }
    ;(err as { cause?: unknown }).cause = err

    expect(describeException(err)).toBe('Error: self → [cycle]')
  })

  it('renders plain values without pretending they are errors', () => {
    expect(describeException('timeout')).toBe('timeout')
    expect(describeException(undefined)).toBe('undefined')
  })
})