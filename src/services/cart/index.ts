import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getAvailableStock, syncProductInventory } from '@/services/inventory/sync'
import { getPayloadClient } from '@/lib/payload'
import type { Product } from '@/payload-types'

export const cartItemInputSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().min(1).max(20),
})

export type CartLine = {
  id: string
  cart_id: string
  product_id: string
  variant_id: string | null
  sku: string
  quantity: number
  name: string
  slug: string
  unitPrice: number
  compareAtPrice: number | null
  imageUrl: string | null
  variant: { color?: string | null; size?: string | null; sku: string }
  available: number
  inStock: boolean
  stockStatus: 'ok' | 'insufficient' | 'out_of_stock'
  lineTotal: number
}

export async function getOrCreateUserCart(userId: string) {
  const supabase = getSupabaseAdmin()
  const { data: rows, error: listError } = await supabase
    .from('carts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (listError) throw listError

  if (rows && rows.length > 0) {
    const primary = rows[0]
    // Consolidate duplicate user carts created by parallel getOrCreate races
    for (const extra of rows.slice(1)) {
      const { data: extraItems } = await supabase
        .from('cart_items')
        .select('*')
        .eq('cart_id', extra.id)

      for (const item of extraItems ?? []) {
        const { data: existing } = await supabase
          .from('cart_items')
          .select('*')
          .eq('cart_id', primary.id)
          .eq('sku', item.sku)
          .maybeSingle()

        if (existing) {
          await supabase
            .from('cart_items')
            .update({
              quantity: existing.quantity + item.quantity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        } else {
          await supabase.from('cart_items').insert({
            cart_id: primary.id,
            product_id: item.product_id,
            variant_id: item.variant_id,
            sku: item.sku,
            quantity: item.quantity,
          })
        }
      }

      await supabase.from('cart_items').delete().eq('cart_id', extra.id)
      await supabase.from('carts').delete().eq('id', extra.id)
    }
    return primary
  }

  const { data, error } = await supabase
    .from('carts')
    .insert({ user_id: userId })
    .select('*')
    .single()

  // Parallel insert race: unique/conflict → re-read
  if (error) {
    const { data: again } = await supabase
      .from('carts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (again) return again
    throw error
  }
  return data
}

export async function getOrCreateGuestCart(guestToken: string) {
  const supabase = getSupabaseAdmin()
  const { data: existing } = await supabase
    .from('carts')
    .select('*')
    .eq('guest_token', guestToken)
    .maybeSingle()

  if (existing) return existing

  const { data, error } = await supabase
    .from('carts')
    .insert({ guest_token: guestToken })
    .select('*')
    .single()

  if (error) throw error
  return data
}

/** Find existing guest cart without creating a new empty one. */
export async function findGuestCart(guestToken: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('carts')
    .select('*')
    .eq('guest_token', guestToken)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function mergeGuestCartIntoUser(guestToken: string, userId: string) {
  const supabase = getSupabaseAdmin()
  const guestCart = await findGuestCart(guestToken)
  const userCart = await getOrCreateUserCart(userId)

  if (!guestCart) return userCart
  // Same cart row edge-case (should not happen with owner check)
  if (guestCart.id === userCart.id) return userCart

  const { data: guestItems, error: itemsError } = await supabase
    .from('cart_items')
    .select('*')
    .eq('cart_id', guestCart.id)
  if (itemsError) throw itemsError

  for (const item of guestItems ?? []) {
    const { data: existing } = await supabase
      .from('cart_items')
      .select('*')
      .eq('cart_id', userCart.id)
      .eq('sku', item.sku)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('cart_items')
        .update({
          quantity: existing.quantity + item.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('cart_items').insert({
        cart_id: userCart.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        sku: item.sku,
        quantity: item.quantity,
      })
      if (error) throw error
    }
  }

  await supabase.from('cart_items').delete().eq('cart_id', guestCart.id)
  await supabase.from('carts').delete().eq('id', guestCart.id)
  return userCart
}

export async function addToCart(
  cartId: string,
  input: z.infer<typeof cartItemInputSchema>
) {
  const payload = await getPayloadClient()
  const product = (await payload.findByID({
    collection: 'products',
    id: input.productId,
    depth: 0,
    locale: 'tr',
    overrideAccess: true,
  })) as Product

  if (!product || product._status !== 'published' || !product.isActive) {
    throw new Error('Ürün satışta değil')
  }

  const validSkus = new Set<string>([product.sku].filter(Boolean))
  product.variants?.forEach((v) => v.sku && validSkus.add(v.sku))
  if (!validSkus.has(input.sku)) {
    throw new Error('SKU bu ürüne ait değil')
  }

  await syncProductInventory(product).catch(() => null)

  const available = await getAvailableStock(input.sku)
  if (available < input.quantity) {
    throw new Error(
      available <= 0
        ? 'Bu ürün stokta yok'
        : `Yeterli stok yok (kalan: ${available})`
    )
  }

  const supabase = getSupabaseAdmin()
  const { data: existing, error: findError } = await supabase
    .from('cart_items')
    .select('*')
    .eq('cart_id', cartId)
    .eq('sku', input.sku)
    .maybeSingle()
  if (findError) throw findError

  const nextQty = (existing?.quantity ?? 0) + input.quantity
  if (nextQty > available) {
    throw new Error(`Yeterli stok yok (kalan: ${available})`)
  }

  if (existing) {
    const { data, error } = await supabase
      .from('cart_items')
      .update({ quantity: nextQty, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('cart_items')
    .insert({
      cart_id: cartId,
      product_id: input.productId,
      variant_id: input.variantId ?? null,
      sku: input.sku,
      quantity: input.quantity,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function updateCartItemQuantity(itemId: string, quantity: number) {
  const supabase = getSupabaseAdmin()
  if (quantity <= 0) {
    await supabase.from('cart_items').delete().eq('id', itemId)
    return null
  }

  const { data: item } = await supabase.from('cart_items').select('*').eq('id', itemId).single()
  if (!item) throw new Error('Sepet kalemi bulunamadı')

  // Refresh CMS → inventory before validating
  try {
    const payload = await getPayloadClient()
    const product = (await payload.findByID({
      collection: 'products',
      id: item.product_id,
      depth: 0,
      locale: 'tr',
      overrideAccess: true,
    })) as Product
    await syncProductInventory(product)
  } catch {
    // continue with best-effort stock read
  }

  const available = await getAvailableStock(item.sku)
  if (quantity > available) {
    throw new Error(
      available <= 0 ? 'Bu ürün stokta yok' : `Yeterli stok yok (kalan: ${available})`
    )
  }

  const { data, error } = await supabase
    .from('cart_items')
    .update({ quantity, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function removeCartItem(itemId: string) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('cart_items').delete().eq('id', itemId)
  if (error) throw error
}

function stockStatusFor(available: number, quantity: number): CartLine['stockStatus'] {
  if (available <= 0) return 'out_of_stock'
  if (available < quantity) return 'insufficient'
  return 'ok'
}

export async function getCartWithProducts(cartId: string) {
  const supabase = getSupabaseAdmin()
  const { data: cart } = await supabase.from('carts').select('*').eq('id', cartId).single()
  const { data: items } = await supabase.from('cart_items').select('*').eq('cart_id', cartId)

  const payload = await getPayloadClient()
  const enriched: CartLine[] = []

  for (const item of items ?? []) {
    const product = (await payload
      .findByID({
        collection: 'products',
        id: item.product_id,
        depth: 2,
        locale: 'tr',
        overrideAccess: true,
      })
      .catch(() => null)) as Product | null

    if (!product) continue

    // Live stock: sync CMS stock into inventory, then compute available
    await syncProductInventory(product).catch(() => null)
    const available = await getAvailableStock(item.sku)
    const status = stockStatusFor(available, item.quantity)

    const variant = product.variants?.find((v) => v.sku === item.sku)
    const unitPrice = variant?.price ?? product.price
    const image = product.images?.find((i) => i.isPrimary) || product.images?.[0]
    const imageUrl =
      image && typeof image.image !== 'number'
        ? image.image.sizes?.card?.url || image.image.url || null
        : null

    enriched.push({
      id: item.id,
      cart_id: item.cart_id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      sku: item.sku,
      quantity: item.quantity,
      name: product.name,
      slug: product.slug,
      unitPrice,
      compareAtPrice: product.compareAtPrice ?? null,
      imageUrl,
      variant: variant
        ? { color: variant.color, size: variant.size, sku: variant.sku }
        : { sku: item.sku },
      available,
      inStock: status === 'ok',
      stockStatus: status,
      lineTotal: unitPrice * item.quantity,
    })
  }

  const subtotal = enriched.reduce((s, i) => s + i.lineTotal, 0)
  const hasStockIssues = enriched.some((i) => i.stockStatus !== 'ok')
  // Block checkout when any line is out of stock / insufficient (empty cart handled in UI)
  const checkoutBlocked = hasStockIssues

  let couponCode: string | null = cart?.coupon_code ?? null
  let discount = 0
  if (couponCode) {
    const { validateCoupon } = await import('@/services/coupons')
    const result = await validateCoupon({
      code: couponCode,
      subtotal,
      userId: cart?.user_id ?? null,
    })
    if (result.valid) {
      discount = result.discount
      couponCode = result.coupon.code
    } else {
      // Stale/invalid coupon — clear from cart
      await supabase.from('carts').update({ coupon_code: null }).eq('id', cartId)
      couponCode = null
      discount = 0
    }
  }

  return {
    cart,
    items: enriched,
    subtotal,
    itemCount: enriched.reduce((s, i) => s + i.quantity, 0),
    hasStockIssues,
    checkoutBlocked,
    couponCode,
    discount,
  }
}

/** Throws if any cart line cannot be fulfilled. */
export async function assertCartStockAvailable(cartId: string) {
  const { items, hasStockIssues } = await getCartWithProducts(cartId)
  if (!items.length) throw new Error('Sepet boş')
  if (hasStockIssues) {
    const bad = items.filter((i) => i.stockStatus !== 'ok')
    const names = bad.map((i) => i.name).join(', ')
    throw new Error(`Sepetinizde stok sorunu var: ${names}`)
  }
  return items
}
