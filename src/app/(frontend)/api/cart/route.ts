import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import {
  addToCart,
  getCartWithProducts,
  getOrCreateGuestCart,
  getOrCreateUserCart,
  mergeGuestCartIntoUser,
  removeCartItem,
  updateCartItemQuantity,
  cartItemInputSchema,
} from '@/services/cart'
import { getErrorMessage } from '@/lib/errors'
import { z } from 'zod'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

async function resolveUser(request: Request): Promise<User | null> {
  const authHeader = request.headers.get('authorization')
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

  if (bearer) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (url && anon) {
      const client = createSupabaseClient<Database>(url, anon, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data } = await client.auth.getUser(bearer)
      if (data.user) return data.user
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

async function resolveCart(request: Request, guestToken?: string | null) {
  const user = await resolveUser(request)
  if (user) {
    // If a guest cart token is still present, merge it before returning the user cart.
    // Fixes: items added as guest (or during auth race) then checkout refresh as user → empty.
    if (guestToken) {
      await mergeGuestCartIntoUser(guestToken, user.id).catch((err) => {
        console.error('[resolveCart] merge failed:', getErrorMessage(err))
      })
    }
    return getOrCreateUserCart(user.id)
  }
  if (!guestToken) throw new Error('guestToken gerekli')
  return getOrCreateGuestCart(guestToken)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const guestToken = searchParams.get('guestToken')
    const cart = await resolveCart(request, guestToken)
    const data = await getCartWithProducts(cart.id)
    return NextResponse.json(data)
  } catch (e) {
    const message = getErrorMessage(e, 'Sepet alınamadı')
    console.error('[GET /api/cart]', message, e)
    // Do not pretend success with an empty cart — client must retry with guestToken/auth
    return NextResponse.json({ error: message, items: [], itemCount: 0, subtotal: 0 }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const input = cartItemInputSchema.parse(body)
    const cart = await resolveCart(request, body.guestToken)
    const item = await addToCart(cart.id, input)
    const data = await getCartWithProducts(cart.id)
    return NextResponse.json({ item, ...data })
  } catch (e) {
    const message = getErrorMessage(e, 'Sepete eklenemedi')
    console.error('[POST /api/cart]', message, e)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = z
      .object({ itemId: z.string().uuid(), quantity: z.number().int() })
      .parse(await request.json())
    const item = await updateCartItemQuantity(body.itemId, body.quantity)
    const cartId = item?.cart_id
    if (!cartId) {
      return NextResponse.json({ item: null, items: [], itemCount: 0, subtotal: 0 })
    }
    const data = await getCartWithProducts(cartId)
    return NextResponse.json({ item, ...data })
  } catch (e) {
    const message = getErrorMessage(e, 'Güncellenemedi')
    console.error('[PATCH /api/cart]', message, e)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    const body = z.object({ itemId: z.string().uuid() }).parse(await request.json())
    // Load cart id before delete for refreshed snapshot
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    const admin = getSupabaseAdmin()
    const { data: existing } = await admin
      .from('cart_items')
      .select('cart_id')
      .eq('id', body.itemId)
      .maybeSingle()

    await removeCartItem(body.itemId)

    if (!existing?.cart_id) {
      return NextResponse.json({ ok: true, items: [], itemCount: 0, subtotal: 0 })
    }
    const data = await getCartWithProducts(existing.cart_id)
    return NextResponse.json({ ok: true, ...data })
  } catch (e) {
    const message = getErrorMessage(e, 'Silinemedi')
    console.error('[DELETE /api/cart]', message, e)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
