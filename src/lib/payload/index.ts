import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

let payloadPromise: Promise<Payload> | null = null

function assertDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error(
      'DATABASE_URL is missing. Set it in .env.local to your Supabase Postgres URI (Dashboard → Connect).'
    )
  }
  try {
    const host = new URL(url).hostname
    if (host === '127.0.0.1' || host === 'localhost') {
      throw new Error(
        'DATABASE_URL points to localhost. Use your Supabase Postgres connection string instead.'
      )
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('DATABASE_URL')) throw e
    throw new Error('DATABASE_URL is not a valid PostgreSQL connection URI.')
  }
}

/**
 * Lazy Payload init. Callers must catch — CMS may be unconfigured during Phase 1.
 */
export async function getPayloadClient(): Promise<Payload> {
  assertDatabaseUrl()

  if (!payloadPromise) {
    payloadPromise = getPayload({ config }).catch((err) => {
      payloadPromise = null
      console.error('[getPayloadClient] Payload init failed:', err)
      throw err instanceof Error ? err : new Error(String(err ?? 'Payload init failed'))
    })
  }

  return payloadPromise
}

export function isPayloadConfigured() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) return false
  try {
    const host = new URL(url).hostname
    return host !== '127.0.0.1' && host !== 'localhost'
  } catch {
    return false
  }
}
