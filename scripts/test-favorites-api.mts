import { createClient } from '@supabase/supabase-js'

/**
 * End-to-end: create user → sign in → call local /api/favorites with auth cookies.
 */
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const email = `api-fav-${Date.now()}@example.com`
  const password = 'TestPass123!'

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: 'Api', last_name: 'Fav' },
  })
  if (createErr) throw new Error(createErr.message)
  const userId = created.user!.id

  await admin.from('profiles').upsert({
    id: userId,
    email,
    first_name: 'Api',
    last_name: 'Fav',
  })

  const authClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: signed, error: signErr } = await authClient.auth.signInWithPassword({
    email,
    password,
  })
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
  // @supabase/ssr stores base64url JSON, possibly chunked; for short sessions one cookie works
  const cookieValue = Buffer.from(JSON.stringify(sessionPayload), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const cookieHeader = `${cookieName}=base64-${cookieValue}`

  const post = await fetch(`${site}/api/favorites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ productId: '1' }),
  })
  const postBody = await post.json()
  console.log('POST status', post.status, postBody)

  if (!post.ok) {
    throw new Error(`API POST failed: ${JSON.stringify(postBody)}`)
  }
  if (postBody.favorited !== true) {
    throw new Error(`Expected favorited=true, got ${JSON.stringify(postBody)}`)
  }

  const get = await fetch(`${site}/api/favorites?productId=1`, {
    headers: { Cookie: cookieHeader },
  })
  const getBody = await get.json()
  console.log('GET status', get.status, getBody)
  if (!get.ok || getBody.favorited !== true) {
    throw new Error(`API GET failed: ${JSON.stringify(getBody)}`)
  }

  // toggle off
  const post2 = await fetch(`${site}/api/favorites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ productId: '1' }),
  })
  const post2Body = await post2.json()
  console.log('POST toggle-off', post2.status, post2Body)
  if (!post2.ok || post2Body.favorited !== false) {
    throw new Error(`toggle-off failed: ${JSON.stringify(post2Body)}`)
  }

  await admin.from('favorites').delete().eq('user_id', userId)
  await admin.auth.admin.deleteUser(userId)
  console.log('ALL_OK_API')
}

main().catch(async (e) => {
  console.error('FAIL', e instanceof Error ? e.message : e)
  process.exit(1)
})
