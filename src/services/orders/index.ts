import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getCartWithProducts } from '@/services/cart'
import { validateCoupon } from '@/services/coupons'
import { commitStock, releaseStock, reserveStock } from '@/services/inventory/sync'
import { calculateShipping } from '@/services/shipping'
import { getPaymentProvider } from '@/services/payment'
import { absoluteUrl } from '@/lib/utils'

export const checkoutAddressSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  city: z.string().min(2),
  district: z.string().optional(),
  neighborhood: z.string().optional(),
  addressLine: z.string().min(5),
  postalCode: z.string().optional(),
})

export const checkoutSchema = z.object({
  cartId: z.string().uuid(),
  guestToken: z.string().min(8).optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  shippingMethod: z.enum(['standard', 'express']).default('standard'),
  address: checkoutAddressSchema,
  couponCode: z.string().optional().nullable(),
  idempotencyKey: z.string().min(8),
  clientIp: z.string().default('127.0.0.1'),
})

function generateOrderNumber() {
  const date = new Date()
  const y = date.getFullYear().toString().slice(-2)
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `SC${y}${m}${d}${nanoid(6).toUpperCase()}`
}

async function assertCartAccess(
  cartId: string,
  userId?: string | null,
  guestToken?: string | null
) {
  const supabase = getSupabaseAdmin()
  const { data: cart, error } = await supabase.from('carts').select('*').eq('id', cartId).maybeSingle()
  if (error) throw error
  if (!cart) throw new Error('Sepet bulunamadı')

  if (userId) {
    if (cart.user_id !== userId) throw new Error('Bu sepet size ait değil')
    return cart
  }

  if (!guestToken || cart.guest_token !== guestToken) {
    throw new Error('Misafir sepet doğrulanamadı')
  }
  return cart
}

async function releaseReservations(
  items: Array<{ sku: string; quantity: number }>,
  idempotencyKey: string
) {
  for (const item of items) {
    await releaseStock(
      item.sku,
      item.quantity,
      `${idempotencyKey}:release:${item.sku}`
    ).catch((err) => {
      console.error('[releaseReservations]', item.sku, err)
    })
  }
}

/**
 * Server-side checkout: never trusts client prices.
 * Re-fetches product prices from CMS and stock from Supabase.
 */
export async function createCheckoutSession(input: z.infer<typeof checkoutSchema>) {
  const data = checkoutSchema.parse(input)
  const supabase = getSupabaseAdmin()

  const { data: existing } = await supabase
    .from('orders')
    .select('*')
    .eq('idempotency_key', data.idempotencyKey)
    .maybeSingle()
  if (existing) {
    if (existing.payment_status === 'paid') {
      return { order: existing, payment: null, reused: true as const }
    }
    // Re-init payment for the same idempotent checkout attempt
    if (existing.payment_status === 'pending') {
      const cart = await getCartWithProducts(data.cartId)
      const provider = getPaymentProvider()
      const paymentInit = await provider.createPayment({
        orderId: existing.id,
        orderNumber: existing.order_number,
        amount: Number(existing.total),
        currency: 'TRY',
        buyer: {
          id: data.userId || data.address.email,
          name: data.address.firstName,
          surname: data.address.lastName,
          email: data.address.email,
          phone: data.address.phone,
          ip: data.clientIp,
          city: data.address.city,
          country: 'Turkey',
          address: data.address.addressLine,
        },
        basketItems: [
          ...cart.items.map((item) => ({
            id: item.sku,
            name: item.name,
            category: 'Deri',
            price: item.lineTotal,
          })),
          ...(Number(existing.shipping_cost) > 0
            ? [
                {
                  id: `shipping-${existing.shipping_method || 'standard'}`,
                  name: 'Kargo',
                  category: 'Kargo',
                  price: Number(existing.shipping_cost),
                },
              ]
            : []),
        ],
        callbackUrl: absoluteUrl('/api/payments/callback'),
      })
      return { order: existing, payment: paymentInit, reused: true as const }
    }
    return { order: existing, payment: null, reused: true as const }
  }

  await assertCartAccess(data.cartId, data.userId, data.guestToken)

  const cart = await getCartWithProducts(data.cartId)
  if (!cart.items.length) {
    throw new Error('Sepet boş')
  }
  if (cart.checkoutBlocked || cart.hasStockIssues) {
    const bad = cart.items.filter((i) => i.stockStatus !== 'ok').map((i) => i.name)
    throw new Error(
      bad.length
        ? `Sepetinizde stok sorunu var: ${bad.join(', ')}`
        : 'Sepetinizde stok sorunu var'
    )
  }

  const reserved: Array<{ sku: string; quantity: number }> = []
  try {
    for (const item of cart.items) {
      const ok = await reserveStock(
        item.sku,
        item.quantity,
        `${data.idempotencyKey}:reserve:${item.sku}`
      )
      if (!ok) {
        throw new Error(`${item.name} için yeterli stok yok`)
      }
      reserved.push({ sku: item.sku, quantity: item.quantity })
    }

    let discountTotal = 0
    let couponCode: string | null = null
    const codeFromRequest = data.couponCode?.trim() || null
    const codeFromCart = cart.couponCode || cart.cart?.coupon_code || null
    const resolvedCoupon = codeFromRequest || codeFromCart
    if (resolvedCoupon) {
      const coupon = await validateCoupon({
        code: resolvedCoupon,
        subtotal: cart.subtotal,
        userId: data.userId,
        guestEmail: data.address.email,
      })
      if (!coupon.valid) throw new Error(coupon.error)
      discountTotal = coupon.discount
      couponCode = coupon.coupon.code
    }

    const shipping = calculateShipping({
      method: data.shippingMethod,
      subtotal: cart.subtotal - discountTotal,
    })

    const total = Math.max(0, cart.subtotal - discountTotal + shipping.cost)
    const orderNumber = generateOrderNumber()

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: data.userId ?? null,
        guest_email: data.userId ? null : data.address.email,
        status: 'pending_payment',
        payment_status: 'pending',
        subtotal: cart.subtotal,
        discount_total: discountTotal,
        shipping_cost: shipping.cost,
        total,
        currency: 'TRY',
        coupon_code: couponCode,
        shipping_method: shipping.method,
        shipping_address: data.address,
        billing_address: data.address,
        cart_id: data.cartId,
        notes: `cart_id:${data.cartId}`,
        idempotency_key: data.idempotencyKey,
      })
      .select('*')
      .single()

    if (error || !order) throw error || new Error('Sipariş oluşturulamadı')

    const orderItems = cart.items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name_snapshot: item.name,
      product_sku_snapshot: item.sku,
      product_image_snapshot: item.imageUrl,
      unit_price_snapshot: item.unitPrice,
      quantity: item.quantity,
      variant_snapshot: item.variant,
    }))

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems)
    if (itemsError) throw itemsError

    const provider = getPaymentProvider()
    const paymentInit = await provider.createPayment({
      orderId: order.id,
      orderNumber: order.order_number,
      amount: total,
      currency: 'TRY',
      buyer: {
        id: data.userId || data.address.email,
        name: data.address.firstName,
        surname: data.address.lastName,
        email: data.address.email,
        phone: data.address.phone,
        ip: data.clientIp,
        city: data.address.city,
        country: 'Turkey',
        address: data.address.addressLine,
      },
      basketItems: [
        ...cart.items.map((item) => ({
          id: item.sku,
          name: item.name,
          category: 'Deri',
          price: item.lineTotal,
        })),
        ...(shipping.cost > 0
          ? [
              {
                id: `shipping-${shipping.method}`,
                name: shipping.label,
                category: 'Kargo',
                price: shipping.cost,
              },
            ]
          : []),
      ],
      callbackUrl: absoluteUrl('/api/payments/callback'),
    })

    await supabase.from('payments').insert({
      order_id: order.id,
      provider: provider.name,
      provider_payment_id: paymentInit.providerPaymentId ?? null,
      amount: total,
      currency: 'TRY',
      status: 'pending',
      raw_response: (paymentInit.raw as import('@/types/database').Json) ?? null,
      idempotency_key: `${data.idempotencyKey}:payment`,
    })

    return { order, payment: paymentInit, reused: false as const }
  } catch (err) {
    if (reserved.length) {
      await releaseReservations(reserved, data.idempotencyKey)
    }
    throw err
  }
}

export async function markOrderPaymentFailed(params: {
  orderId: string
  providerPaymentId?: string
  raw?: unknown
  webhookIdempotencyKey: string
}) {
  const supabase = getSupabaseAdmin()

  const { data: order } = await supabase.from('orders').select('*').eq('id', params.orderId).single()
  if (!order) throw new Error('Order not found')
  if (order.payment_status === 'paid') {
    return { ok: true, ignored: true as const }
  }
  if (order.payment_status === 'failed') {
    return { ok: true, duplicate: true as const }
  }

  const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id)
  for (const item of items ?? []) {
    await releaseStock(
      item.product_sku_snapshot,
      item.quantity,
      `${params.webhookIdempotencyKey}:release:${item.product_sku_snapshot}`
    ).catch(() => null)
  }

  await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      payment_status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  await supabase
    .from('payments')
    .update({
      status: 'failed',
      provider_payment_id: params.providerPaymentId ?? null,
      raw_response: (params.raw as import('@/types/database').Json) ?? null,
      idempotency_key: params.webhookIdempotencyKey,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', order.id)

  return { ok: true, duplicate: false as const }
}

export async function finalizePaidOrder(params: {
  orderId: string
  providerPaymentId?: string
  amount?: number
  raw?: unknown
  webhookIdempotencyKey: string
}) {
  const supabase = getSupabaseAdmin()

  const { data: existingPayment } = await supabase
    .from('payments')
    .select('*')
    .eq('idempotency_key', params.webhookIdempotencyKey)
    .maybeSingle()

  if (existingPayment?.status === 'paid') {
    return { ok: true, duplicate: true }
  }

  const { data: order } = await supabase.from('orders').select('*').eq('id', params.orderId).single()
  if (!order) throw new Error('Order not found')

  if (params.amount != null && Math.abs(Number(params.amount) - Number(order.total)) > 0.01) {
    throw new Error('Payment amount mismatch')
  }

  if (order.payment_status === 'paid') {
    return { ok: true, duplicate: true }
  }

  const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id)

  for (const item of items ?? []) {
    const ok = await commitStock(
      item.product_sku_snapshot,
      item.quantity,
      order.id,
      `${params.webhookIdempotencyKey}:commit:${item.product_sku_snapshot}`
    )
    if (!ok) {
      throw new Error(`Stock commit failed for ${item.product_sku_snapshot}`)
    }
  }

  await supabase
    .from('orders')
    .update({
      status: 'payment_received',
      payment_status: 'paid',
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  await supabase
    .from('payments')
    .update({
      status: 'paid',
      provider_payment_id: params.providerPaymentId ?? null,
      raw_response: (params.raw as import('@/types/database').Json) ?? null,
      idempotency_key: params.webhookIdempotencyKey,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', order.id)

  if (order.coupon_code) {
    const { data: coupon } = await supabase
      .from('coupons')
      .select('id')
      .eq('code', order.coupon_code)
      .maybeSingle()
    if (coupon) {
      await supabase.from('coupon_usages').insert({
        coupon_id: coupon.id,
        user_id: order.user_id,
        order_id: order.id,
        guest_email: order.guest_email,
      })
    }
  }

  // Clear cart after successful payment (user or guest via notes cart_id)
  const cartIdFromNotes =
    typeof order.notes === 'string' && order.notes.startsWith('cart_id:')
      ? order.notes.slice('cart_id:'.length)
      : null
  const cartId = (order as { cart_id?: string | null }).cart_id || cartIdFromNotes
  if (cartId) {
    await supabase.from('cart_items').delete().eq('cart_id', cartId)
  } else if (order.user_id) {
    const { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', order.user_id)
      .maybeSingle()
    if (cart) {
      await supabase.from('cart_items').delete().eq('cart_id', cart.id)
    }
  }

  return { ok: true, duplicate: false }
}

export async function getOrderById(orderId: string) {
  const supabase = getSupabaseAdmin()
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
  if (!order) return null
  const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id)
  return { order, items: items ?? [] }
}

export async function getOrderForUser(orderId: string, userId: string) {
  const supabase = getSupabaseAdmin()
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!order) return null

  const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id)
  const { data: payments } = await supabase.from('payments').select('*').eq('order_id', order.id)

  return { order, items: items ?? [], payments: payments ?? [] }
}

export async function listOrdersForUser(userId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * iyzico CF retrieve often omits conversationId. Resolve order via:
 * 1) conversationId (order UUID we sent at initialize)
 * 2) basketId (our order_number)
 * 3) CF token stored as payments.provider_payment_id at initialize
 */
export async function resolveOrderIdFromPaymentResult(input: {
  orderId?: string | null
  basketId?: string | null
  token?: string | null
  providerPaymentId?: string | null
}): Promise<string | null> {
  if (input.orderId) return input.orderId

  const supabase = getSupabaseAdmin()

  if (input.basketId) {
    const { data } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', input.basketId)
      .maybeSingle()
    if (data?.id) return data.id
  }

  const token = input.token || null
  if (token) {
    const { data } = await supabase
      .from('payments')
      .select('order_id')
      .eq('provider_payment_id', token)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data?.order_id) return data.order_id
  }

  return null
}

export { ORDER_STATUS_LABELS } from '@/lib/labels'
