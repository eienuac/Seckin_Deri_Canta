import { NextResponse } from 'next/server'
import { getPaymentProvider } from '@/services/payment'
import { finalizePaidOrder, markOrderPaymentFailed } from '@/services/orders'
import { createHash } from 'crypto'

export async function POST(request: Request) {
  const body = await request.text()
  const provider = getPaymentProvider()
  const verified = await provider.verifyWebhook(request.headers, body)

  if (!verified.valid || !verified.orderId) {
    return NextResponse.json({ error: 'Invalid webhook' }, { status: 401 })
  }

  const webhookIdempotencyKey = createHash('sha256')
    .update(`${verified.providerPaymentId || ''}:${verified.orderId}:${verified.status || 'unknown'}`)
    .digest('hex')

  try {
    if (verified.status === 'paid') {
      const result = await finalizePaidOrder({
        orderId: verified.orderId,
        providerPaymentId: verified.providerPaymentId,
        amount: verified.amount,
        raw: verified.raw,
        webhookIdempotencyKey,
      })
      return NextResponse.json(result)
    }

    if (verified.status === 'failed') {
      const result = await markOrderPaymentFailed({
        orderId: verified.orderId,
        providerPaymentId: verified.providerPaymentId,
        raw: verified.raw,
        webhookIdempotencyKey,
      })
      return NextResponse.json(result)
    }

    return NextResponse.json({ ok: true, ignored: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Finalize failed' },
      { status: 500 }
    )
  }
}
