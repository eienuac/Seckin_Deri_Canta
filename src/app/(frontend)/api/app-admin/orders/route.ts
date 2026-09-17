import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAppAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function PATCH(request: Request) {
  const admin = await requireAppAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = z
    .object({
      orderId: z.string().uuid(),
      status: z.string(),
      trackingNumber: z.string().optional(),
    })
    .parse(await request.json())

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('orders')
    .update({
      status: body.status as never,
      tracking_number: body.trackingNumber || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.orderId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
