import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const createReturnSchema = z.object({
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.string().min(3),
  description: z.string().optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        quantity: z.number().int().min(1),
        photoUrls: z.array(z.string().url()).optional(),
      })
    )
    .min(1),
})

export async function createReturnRequest(input: z.infer<typeof createReturnSchema>) {
  const data = createReturnSchema.parse(input)
  const supabase = getSupabaseAdmin()

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', data.orderId)
    .eq('user_id', data.userId)
    .single()

  if (!order) throw new Error('Sipariş bulunamadı')
  if (order.status !== 'delivered') {
    throw new Error('Yalnızca teslim edilmiş siparişler için iade açılabilir')
  }

  const { data: request, error } = await supabase
    .from('return_requests')
    .insert({
      order_id: data.orderId,
      user_id: data.userId,
      reason: data.reason,
      description: data.description ?? null,
      status: 'requested',
    })
    .select('*')
    .single()

  if (error || !request) throw error || new Error('İade talebi oluşturulamadı')

  const items = data.items.map((item) => ({
    return_request_id: request.id,
    order_item_id: item.orderItemId,
    quantity: item.quantity,
    photo_urls: item.photoUrls ?? [],
  }))

  const { error: itemsError } = await supabase.from('return_items').insert(items)
  if (itemsError) throw itemsError

  return request
}

export async function updateReturnStatus(
  returnId: string,
  status: string,
  adminNotes?: string
) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('return_requests')
    .update({
      status: status as never,
      admin_notes: adminNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', returnId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export { RETURN_STATUS_LABELS } from '@/lib/labels'
