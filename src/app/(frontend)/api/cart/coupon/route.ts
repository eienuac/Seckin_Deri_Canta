import { NextResponse } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getCartWithProducts } from '@/services/cart'
import { validateCoupon } from '@/services/coupons'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    if (!rateLimit(`coupon:${ip}`, 15, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = z
      .object({ code: z.string(), cartId: z.string().uuid() })
      .parse(await request.json())

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const cart = await getCartWithProducts(body.cartId)
    const result = await validateCoupon({
      code: body.code,
      subtotal: cart.subtotal,
      userId: user?.id,
    })

    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    await admin.from('carts').update({ coupon_code: result.coupon.code }).eq('id', body.cartId)

    return NextResponse.json({ discount: result.discount, code: result.coupon.code })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Kupon uygulanamadı' },
      { status: 400 }
    )
  }
}
