import { NextResponse } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createReview, listApprovedReviews } from '@/services/reviews'
import { getErrorMessage } from '@/lib/errors'
import { rateLimit } from '@/lib/rate-limit'

export async function GET(request: Request) {
  const productId = new URL(request.url).searchParams.get('productId')
  if (!productId) {
    return NextResponse.json({ error: 'productId gerekli' }, { status: 400 })
  }
  const reviews = await listApprovedReviews(productId)
  const avg =
    reviews.length === 0
      ? 0
      : Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
  return NextResponse.json({ reviews, averageRating: avg, count: reviews.length })
}

export async function POST(request: Request) {
  try {
    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    if (!rateLimit(`reviews:${ip}`, 20, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = z
      .object({
        productId: z.string().min(1),
        orderId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        title: z.string().max(120).optional(),
        comment: z.string().max(2000).optional(),
      })
      .parse(await request.json())

    const review = await createReview({
      userId: user.id,
      productId: body.productId,
      orderId: body.orderId,
      rating: body.rating,
      title: body.title,
      comment: body.comment,
    })

    return NextResponse.json({ review })
  } catch (e) {
    return NextResponse.json({ error: getErrorMessage(e, 'Yorum eklenemedi') }, { status: 400 })
  }
}
