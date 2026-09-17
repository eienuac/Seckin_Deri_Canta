import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listShippingMethods } from '@/services/shipping'

export async function GET(request: Request) {
  const subtotal = Number(new URL(request.url).searchParams.get('subtotal') || '0')
  const methods = listShippingMethods(Number.isFinite(subtotal) ? subtotal : 0)
  return NextResponse.json({ methods })
}

export async function POST(request: Request) {
  const body = z
    .object({
      method: z.enum(['standard', 'express']).default('standard'),
      subtotal: z.number().nonnegative(),
    })
    .parse(await request.json())

  const methods = listShippingMethods(body.subtotal)
  const selected = methods.find((m) => m.method === body.method) || methods[0]
  return NextResponse.json({ shipping: selected, methods })
}
