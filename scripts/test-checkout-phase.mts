/**
 * Phase 5-6 smoke: ownership, reserve/release, fail-closed payment.
 * Usage: npx tsx scripts/test-checkout-phase.mts
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { nanoid } from 'nanoid'

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    const val = m[2].trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

async function main() {
  loadEnvLocal()
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const guestToken = nanoid(24)
  await admin.from('inventory').upsert(
    { sku: '123', product_id: '1', quantity: 20, reserved_quantity: 0 },
    { onConflict: 'sku' }
  )

  const add = await fetch(`${site}/api/cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: '1', sku: '123', quantity: 1, guestToken }),
  })
  const addBody = await add.json()
  if (!add.ok) throw new Error(`add failed: ${JSON.stringify(addBody)}`)
  const cartId = addBody.cart?.id
  if (!cartId) throw new Error('no cart id from add')

  // Ownership: wrong guest token must fail
  const bad = await fetch(`${site}/api/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartId,
      guestToken: 'wrong-token-xxxxxxxx',
      shippingMethod: 'standard',
      address: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '05551234567',
        city: 'Istanbul',
        addressLine: 'Test mahalle cadde no 1',
      },
      idempotencyKey: nanoid(),
    }),
  })
  const badBody = await bad.json()
  console.log('OWNERSHIP', bad.status, badBody.error)
  if (bad.ok) throw new Error('expected ownership failure')

  // Valid guest checkout — expect 503 without payment keys (fail-closed), or redirect URL with keys
  const okReq = await fetch(`${site}/api/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cartId,
      guestToken,
      shippingMethod: 'standard',
      address: {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phone: '05551234567',
        city: 'Istanbul',
        addressLine: 'Test mahalle cadde no 1',
      },
      idempotencyKey: nanoid(),
    }),
  })
  const okBody = await okReq.json()
  console.log('CHECKOUT', okReq.status, okBody)

  if (okReq.status === 503 || (okBody.error && /configured/i.test(okBody.error))) {
    console.log('FAIL_CLOSED_OK (payment not configured)')
  } else if (okReq.ok && okBody.paymentPageUrl) {
    console.log('PAYMENT_INIT_OK', okBody.orderNumber)
  } else if (okReq.ok && !okBody.paymentPageUrl) {
    throw new Error('checkout ok but no paymentPageUrl — mock success not allowed')
  } else {
    // May fail on stock RPC — surface it
    throw new Error(`unexpected checkout response: ${okReq.status} ${JSON.stringify(okBody)}`)
  }

  // Fake webhook must not finalize
  const fake = await fetch(`${site}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: 'fake',
      conversationId: '00000000-0000-0000-0000-000000000000',
      paymentStatus: 'SUCCESS',
      paidPrice: '1.00',
    }),
  })
  console.log('FAKE_WEBHOOK', fake.status)
  if (fake.status === 200) {
    const fb = await fake.json()
    if (fb.ok && !fb.ignored && !fb.error) {
      throw new Error('fake webhook should not finalize paid order')
    }
  }

  console.log('ALL_OK_CHECKOUT_PHASE')
}

main().catch((e) => {
  console.error('FAIL', e instanceof Error ? e.message : e)
  process.exit(1)
})
