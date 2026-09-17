import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const reviewSchema = z.object({
  userId: z.string().uuid(),
  productId: z.string().min(1),
  orderId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  comment: z.string().max(2000).optional(),
})

export async function createReview(input: z.infer<typeof reviewSchema>) {
  const data = reviewSchema.parse(input)
  const supabase = getSupabaseAdmin()

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, user_id')
    .eq('id', data.orderId)
    .eq('user_id', data.userId)
    .single()

  if (!order || order.status !== 'delivered') {
    throw new Error('Yalnızca teslim alınan ürünlere yorum yapılabilir')
  }

  const { data: item } = await supabase
    .from('order_items')
    .select('id')
    .eq('order_id', data.orderId)
    .eq('product_id', data.productId)
    .maybeSingle()

  if (!item) throw new Error('Bu siparişte ürün bulunamadı')

  const { data: review, error } = await supabase
    .from('reviews')
    .insert({
      user_id: data.userId,
      product_id: data.productId,
      order_id: data.orderId,
      rating: data.rating,
      title: data.title ?? null,
      comment: data.comment ?? null,
      verified_purchase: true,
      is_approved: false,
    })
    .select('*')
    .single()

  if (error) throw error
  return review
}

export async function listApprovedReviews(productId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .eq('is_approved', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
