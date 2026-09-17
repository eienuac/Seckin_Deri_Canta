/**
 * Cart stock + guest merge smoke test against local API.
 * Usage: npx tsx --env-file=.env.local scripts/test-cart-bugs.mts
 */
import { createClient } from '@supabase/supabase-js'
import { nanoid } from 'nanoid'
import pg from 'pg'

const { Client } = pg

async function main() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const dbUrl = process.env.DATABASE_URL!

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Ensure product has stock for add, then we'll zero it
  const pgClient = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await pgClient.connect()
  await pgClient.query(`update payload.products set stock = 10 where id = 1`)
  await pgClient.end()

  await admin.from('inventory').upsert(
    { sku: '123', product_id: '1', quantity: 10, reserved_quantity: 0 },
    { onConflict: 'sku' }
  )

  const guestToken = nanoid(24)

  // Add as guest
  const add = await fetch(`${site}/api/cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: '1', sku: '123', quantity: 1, guestToken }),
  })
  const addBody = await add.json()
  console.log('ADD', add.status, addBody.item?.id ? 'ok' : addBody)
  if (!add.ok) throw new Error('add failed')

  // Zero CMS stock
  const pg2 = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await pg2.connect()
  await pg2.query(`update payload.products set stock = 0 where id = 1`)
  await pg2.end()

  const get = await fetch(`${site}/api/cart?guestToken=${guestToken}`)
  const getBody = await get.json()
  console.log('GET after stock=0', {
    itemCount: getBody.itemCount,
    available: getBody.items?.[0]?.available,
    stockStatus: getBody.items?.[0]?.stockStatus,
    checkoutBlocked: getBody.checkoutBlocked,
  })
  if (!getBody.checkoutBlocked) throw new Error('expected checkoutBlocked')
  if (getBody.items?.[0]?.stockStatus !== 'out_of_stock') {
    throw new Error(`expected out_of_stock, got ${getBody.items?.[0]?.stockStatus}`)
  }

  // Restore stock for merge test
  const pg3 = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await pg3.connect()
  await pg3.query(`update payload.products set stock = 15 where id = 1`)
  await pg3.end()

  // Add again with stock
  await fetch(`${site}/api/cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: '1', sku: '123', quantity: 2, guestToken }),
  })

  const email = `merge-${Date.now()}@example.com`
  const password = 'TestPass123!'
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr) throw new Error(createErr.message)
  const userId = created.user!.id
  await admin.from('profiles').upsert({ id: userId, email, first_name: 'M', last_name: 'T' })

  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: signed, error: signErr } = await auth.auth.signInWithPassword({ email, password })
  if (signErr || !signed.session) throw new Error(signErr?.message || 'sign-in failed')

  const projectRef = new URL(url).hostname.split('.')[0]
  const cookieName = `sb-${projectRef}-auth-token`
  const sessionPayload = {
    access_token: signed.session.access_token,
    refresh_token: signed.session.refresh_token,
    expires_at: signed.session.expires_at,
    expires_in: signed.session.expires_in,
    token_type: signed.session.token_type,
    user: signed.session.user,
  }
  const cookieValue = Buffer.from(JSON.stringify(sessionPayload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const cookie = `${cookieName}=base64-${cookieValue}`

  const merge = await fetch(`${site}/api/cart/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ guestToken }),
  })
  const mergeBody = await merge.json()
  console.log('MERGE', merge.status, mergeBody)
  if (!merge.ok) throw new Error(`merge failed: ${JSON.stringify(mergeBody)}`)

  const userCart = await fetch(`${site}/api/cart`, { headers: { Cookie: cookie } })
  const userCartBody = await userCart.json()
  console.log('USER CART', {
    itemCount: userCartBody.itemCount,
    sku: userCartBody.items?.[0]?.sku,
  })
  if (!userCartBody.itemCount || userCartBody.itemCount < 1) {
    throw new Error('user cart empty after merge')
  }

  // cleanup
  await admin.from('cart_items').delete().eq('product_id', '1')
  await admin.from('carts').delete().eq('user_id', userId)
  await admin.auth.admin.deleteUser(userId)

  // restore stock for storefront
  const pg4 = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await pg4.connect()
  await pg4.query(`update payload.products set stock = 41 where id = 1`)
  await pg4.end()

  console.log('ALL_OK_CART_BUGS')
}

main().catch((e) => {
  console.error('FAIL', e instanceof Error ? e.message : e)
  process.exit(1)
})
