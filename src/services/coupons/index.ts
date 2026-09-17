import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const couponCodeSchema = z.string().trim().min(2).max(40)

export type CouponValidationResult =
  | { valid: true; discount: number; coupon: { id: string; code: string; type: string; value: number } }
  | { valid: false; error: string }

export async function validateCoupon(params: {
  code: string
  subtotal: number
  userId?: string | null
  guestEmail?: string | null
}): Promise<CouponValidationResult> {
  const code = couponCodeSchema.parse(params.code).toUpperCase()
  const supabase = getSupabaseAdmin()

  const { data: coupon } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (!coupon) return { valid: false, error: 'Geçersiz kupon kodu' }

  const now = new Date()
  if (coupon.starts_at && new Date(coupon.starts_at) > now) {
    return { valid: false, error: 'Kupon henüz aktif değil' }
  }
  if (coupon.ends_at && new Date(coupon.ends_at) < now) {
    return { valid: false, error: 'Kupon süresi dolmuş' }
  }
  if (coupon.min_subtotal && params.subtotal < Number(coupon.min_subtotal)) {
    return { valid: false, error: `Minimum sepet tutarı ${coupon.min_subtotal} TL` }
  }

  if (coupon.usage_limit != null) {
    const { count } = await supabase
      .from('coupon_usages')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
    if ((count ?? 0) >= coupon.usage_limit) {
      return { valid: false, error: 'Kupon kullanım limitine ulaşıldı' }
    }
  }

  if (coupon.per_user_limit != null && params.userId) {
    const { count } = await supabase
      .from('coupon_usages')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('user_id', params.userId)
    if ((count ?? 0) >= coupon.per_user_limit) {
      return { valid: false, error: 'Bu kuponu daha önce kullandınız' }
    }
  }

  let discount = 0
  if (coupon.type === 'percent') {
    discount = (params.subtotal * Number(coupon.value)) / 100
    if (coupon.max_discount != null) {
      discount = Math.min(discount, Number(coupon.max_discount))
    }
  } else {
    discount = Number(coupon.value)
  }

  discount = Math.min(discount, params.subtotal)
  discount = Math.round(discount * 100) / 100

  return {
    valid: true,
    discount,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
    },
  }
}
