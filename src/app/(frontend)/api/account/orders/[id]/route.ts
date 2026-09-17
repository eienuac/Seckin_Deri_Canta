import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrderForUser } from '@/services/orders'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await getOrderForUser(id, user.id)
  if (!data) return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 })
  return NextResponse.json(data)
}
