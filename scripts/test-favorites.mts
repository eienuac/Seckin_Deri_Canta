import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) throw new Error('Missing Supabase env')

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profiles, error: pErr } = await admin.from('profiles').select('id,email').limit(1)
  if (pErr) throw new Error(`profiles: ${pErr.message}`)
  console.log('profiles ok', profiles?.length)

  const { error: fErr } = await admin.from('favorites').select('id').limit(1)
  if (fErr) throw new Error(`favorites select: ${fErr.message}`)
  console.log('favorites table visible to PostgREST')

  const userId = profiles![0]!.id
  const productId = '1'

  await admin.from('favorites').delete().eq('user_id', userId).eq('product_id', productId)

  const { data: inserted, error: insErr } = await admin
    .from('favorites')
    .insert({ user_id: userId, product_id: productId })
    .select('*')
    .single()
  if (insErr) throw new Error(`insert: ${insErr.message}`)
  console.log('insert ok', inserted?.id)

  const { data: listed, error: listErr } = await admin
    .from('favorites')
    .select('*')
    .eq('user_id', userId)
    .eq('product_id', productId)
  if (listErr) throw new Error(`list: ${listErr.message}`)
  console.log('list ok', listed?.length)

  const { error: remErr } = await admin
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId)
  if (remErr) throw new Error(`delete: ${remErr.message}`)
  console.log('delete ok')

  // Re-insert so UI can see a row after toggle if needed; leave clean
  console.log('ALL_OK')
}

main().catch((e) => {
  console.error('FAIL', e instanceof Error ? e.message : e)
  process.exit(1)
})
