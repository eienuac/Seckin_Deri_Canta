import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAppAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function PATCH(request: Request) {
  const admin = await requireAppAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = z
    .object({ reviewId: z.string().uuid(), isApproved: z.boolean() })
    .parse(await request.json())

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('reviews')
    .update({ is_approved: body.isApproved })
    .eq('id', body.reviewId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
