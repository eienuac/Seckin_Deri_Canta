import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listOrdersForUser } from '@/services/orders'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orders = await listOrdersForUser(user.id)
  return NextResponse.json({ orders })
}
