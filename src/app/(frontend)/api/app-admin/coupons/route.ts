import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAppAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const admin = await requireAppAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = z
    .object({
      code: z.string().min(2),
      type: z.enum(['percent', 'fixed']),
      value: z.number().positive(),
      min_subtotal: z.number().optional(),
      max_discount: z.number().optional(),
      usage_limit: z.number().optional(),
      per_user_limit: z.number().optional(),
    })
    .parse(await request.json())

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('coupons').insert({
    code: body.code.toUpperCase(),
    type: body.type,
    value: body.value,
    min_subtotal: body.min_subtotal ?? 0,
    max_discount: body.max_discount ?? null,
    usage_limit: body.usage_limit ?? null,
    per_user_limit: body.per_user_limit ?? 1,
    is_active: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
