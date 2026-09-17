import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { checkoutSchema, createCheckoutSession } from '@/services/orders'
import { headers } from 'next/headers'
import { rateLimit } from '@/lib/rate-limit'
import { getErrorMessage } from '@/lib/errors'
import type { Database } from '@/types/database'
import type { User } from '@supabase/supabase-js'

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

export async function POST(request: Request) {
  try {
    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    if (!rateLimit(`checkout:${ip}`, 10, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await request.json()
    const user = await resolveUser(request)

    const parsed = checkoutSchema.parse({
      ...body,
      userId: user?.id ?? null,
      clientIp: ip,
    })

    const result = await createCheckoutSession(parsed)
    return NextResponse.json({
      orderId: result.order.id,
      orderNumber: result.order.order_number,
      paymentPageUrl: result.payment?.paymentPageUrl,
      token: result.payment?.token,
      reused: result.reused,
    })
  } catch (e) {
    const message = getErrorMessage(e, 'Checkout failed')
    console.error('[POST /api/checkout]', message, e)
    const status = message.toLowerCase().includes('configured') ? 503 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
