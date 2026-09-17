import { NextResponse } from 'next/server'
import { requireAppAdmin } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ user: null, isAppAdmin: false })

  const admin = await requireAppAdmin()
  return NextResponse.json({
    user: { id: user.id, email: user.email },
    isAppAdmin: Boolean(admin),
  })
}
