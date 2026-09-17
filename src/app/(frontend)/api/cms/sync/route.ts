import { NextResponse } from 'next/server'
import { syncProductInventory } from '@/services/inventory/sync'
import { timingSafeEqual, createHmac } from 'crypto'

function verifySecret(request: Request) {
  const secret = process.env.SYNC_WEBHOOK_SECRET
  if (!secret) return false
  const header = request.headers.get('x-sync-secret') || ''
  const a = Buffer.from(header)
  const b = Buffer.from(secret)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const doc = body.doc || body
  if (!doc?.id || !doc?.sku) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  await syncProductInventory(doc)
  return NextResponse.json({ ok: true })
}

/** Optional signed body verification helper for future use */
export function signBody(body: string) {
  const secret = process.env.SYNC_WEBHOOK_SECRET || ''
  return createHmac('sha256', secret).update(body).digest('hex')
}
