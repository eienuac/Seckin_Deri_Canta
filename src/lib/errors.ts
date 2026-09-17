/** Normalize thrown values (PostgrestError, Zod, Error) into a message string. */
export function getErrorMessage(error: unknown, fallback = 'Failed'): string {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object') {
    const maybe = error as { message?: unknown; error?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    if (typeof maybe.message === 'string' && maybe.message) {
      const parts = [maybe.message]
      if (typeof maybe.code === 'string' && maybe.code) parts.push(`(${maybe.code})`)
      if (typeof maybe.details === 'string' && maybe.details) parts.push(maybe.details)
      if (typeof maybe.hint === 'string' && maybe.hint) parts.push(maybe.hint)
      return parts.join(' — ')
    }
    if (typeof maybe.error === 'string' && maybe.error) return maybe.error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return fallback
  }
}
