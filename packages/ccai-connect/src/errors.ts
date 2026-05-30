export class CCAIConnectError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown
  ) {
    super(message)
    this.name = 'CCAIConnectError'
  }
}

export function errorMessageFromBody(parsed: unknown, status: number): string {
  if (typeof parsed === 'object' && parsed !== null) {
    const o = parsed as Record<string, unknown>
    if (typeof o.message === 'string') return o.message
    if (typeof o.error === 'string') return o.error
    const err = o.error
    if (err && typeof err === 'object' && 'message' in err) {
      return String((err as { message?: unknown }).message ?? `HTTP ${status}`)
    }
  }
  return `HTTP ${status}`
}
