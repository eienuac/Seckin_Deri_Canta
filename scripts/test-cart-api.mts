/**
 * E2E: guest cart add → get → update qty → stock reject → merge to user
 */
import { createClient } from '@supabase/supabase-js'
import { nanoid } from 'nanoid'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Ensure inventory for SKU 123
  const { data: inv } = await admin.from('inventory').select('*').eq('sku', '123').maybeSingle()
  if (!inv) {
    const { error } = await admin.from('inventory').insert({
      sku: '123',
      product_id: '1',
      variant_id: null,
      quantity: 25,
      reserved_quantity: 0,
    })
    if (error) throw new Error(`inventory seed: ${error.message}`)
  } else if (inv.quantity < 5) {
    await admin.from('inventory').update({ quantity: 25 }).eq('sku', '123')
  }
  console.log('inventory ready for SKU 123')

  const guestToken = nanoid(24)

  // GET empty-ish cart (creates guest cart)
  const get1 = await fetch(`${site}/api/cart?guestToken=${guestToken}`)
  const get1Body = await get1.json()
  console.log('GET guest', get1.status, { itemCount: get1Body.itemCount, error: get1Body.error })
  if (get1Body.error && !get1Body.cart) throw new Error(`GET failed: ${get1Body.error}`)

  // POST add
  const post = await fetch(`${site}/api/cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: '1',
      sku: '123',
      quantity: 2,
      guestToken,
    }),
  })
  const postBody = await post.json()
  console.log('POST add', post.status, postBody)
  if (!post.ok) throw new Error(`POST add failed: ${JSON.stringify(postBody)}`)

  // GET with items
  const get2 = await fetch(`${site}/api/cart?guestToken=${guestToken}`)
  const get2Body = await get2.json()
  console.log('GET after add', get2.status, {
    itemCount: get2Body.itemCount,
    subtotal: get2Body.subtotal,
    available: get2Body.items?.[0]?.available,
  })
  if (get2Body.itemCount !== 2) throw new Error(`expected itemCount 2, got ${get2Body.itemCount}`)

  const itemId = get2Body.items[0].id as string

  // PATCH qty
  const patch = await fetch(`${site}/api/cart`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, quantity: 3 }),
  })
  const patchBody = await patch.json()
  console.log('PATCH qty', patch.status, patchBody)
  if (!patch.ok) throw new Error(`PATCH failed: ${JSON.stringify(patchBody)}`)

  // Stock reject: try qty 999
  const over = await fetch(`${site}/api/cart`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, quantity: 999 }),
  })
  const overBody = await over.json()
  console.log('PATCH overstock', over.status, overBody)
  if (over.ok) throw new Error('expected overstock to fail')
  if (!String(overBody.error || '').toLowerCase().includes('stok')) {
    throw new Error(`unexpected overstock error: ${JSON.stringify(overBody)}`)
  }

  // Create user and merge
  const email = `cart-test-${Date.now()}@example.com`
  const password = 'TestPass123!'
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr) throw new Error(createErr.message)
  const userId = created.user!.id
  await admin.from('profiles').upsert({ id: userId, email, first_name: 'Cart', last_name: 'Test' })

  const authClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: signed, error: signErr } = await authClient.auth.signInWithPassword({ email, password })
  if (signErr || !signed.session) throw new Error(signErr?.message || 'no session')

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
  const cookieHeader = `${cookieName}=base64-${cookieValue}`

  const merge = await fetch(`${site}/api/cart/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({ guestToken }),
  })
  const mergeBody = await merge.json()
  console.log('MERGE', merge.status, mergeBody)
  if (!merge.ok) throw new Error(`merge failed: ${JSON.stringify(mergeBody)}`)

  const userCart = await fetch(`${site}/api/cart`, { headers: { Cookie: cookieHeader } })
  const userCartBody = await userCart.json()
  console.log('USER cart', userCart.status, {
    itemCount: userCartBody.itemCount,
    subtotal: userCartBody.subtotal,
  })
  if (userCartBody.itemCount < 1) throw new Error('user cart empty after merge')

  // Cleanup
  if (userCartBody.items?.[0]?.id) {
    await fetch(`${site}/api/cart`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ itemId: userCartBody.items[0].id }),
    })
  }
  await admin.from('cart_items').delete().eq('product_id', '1')
  await admin.from('carts').delete().eq('user_id', userId)
  await admin.auth.admin.deleteUser(userId)

  console.log('ALL_OK_CART')
}

main().catch((e) => {
  console.error('FAIL', e instanceof Error ? e.message : e)
  process.exit(1)
})
