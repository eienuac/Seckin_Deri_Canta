import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()
  // Soft-delete profile data; auth user deletion requires service role
  await admin.from('profiles').update({ email: null, phone: null, first_name: 'Silindi', last_name: '' }).eq('id', user.id)
  await admin.auth.admin.deleteUser(user.id)
  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}
