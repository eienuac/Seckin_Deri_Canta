import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const email = `fav-test-${Date.now()}@example.com`
  const password = 'TestPass123!'

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: 'Fav', last_name: 'Test' },
  })
  if (createErr) throw new Error(`createUser: ${createErr.message}`)
  const userId = created.user!.id
  console.log('created user', userId)

  // Ensure profile
  await admin.from('profiles').upsert({
    id: userId,
    email,
    first_name: 'Fav',
    last_name: 'Test',
  })

  const userClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: signed, error: signErr } = await userClient.auth.signInWithPassword({
    email,
    password,
  })
  if (signErr) throw new Error(`signIn: ${signErr.message}`)
  console.log('signed in', !!signed.session)

  const productId = '1'
  const { error: insErr } = await userClient
    .from('favorites')
    .insert({ user_id: userId, product_id: productId })
  if (insErr) throw new Error(`RLS insert: ${insErr.message}`)
  console.log('RLS insert ok')

  const { data: rows, error: selErr } = await userClient
    .from('favorites')
    .select('*')
    .eq('product_id', productId)
  if (selErr) throw new Error(`RLS select: ${selErr.message}`)
  console.log('RLS select ok', rows?.length)

  const { error: delErr } = await userClient
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId)
  if (delErr) throw new Error(`RLS delete: ${delErr.message}`)
  console.log('RLS delete ok')

  // Hit local API with bearer via cookie simulation isn't trivial;
  // instead call toggle through service-role path used by API fallback.
  const { error: reIns } = await userClient
    .from('favorites')
    .insert({ user_id: userId, product_id: productId })
  if (reIns) throw new Error(reIns.message)

  // Cleanup test user
  await admin.from('favorites').delete().eq('user_id', userId)
  await admin.auth.admin.deleteUser(userId)
  console.log('ALL_OK_RLS')
}

main().catch((e) => {
  console.error('FAIL', e instanceof Error ? e.message : e)
  process.exit(1)
})
