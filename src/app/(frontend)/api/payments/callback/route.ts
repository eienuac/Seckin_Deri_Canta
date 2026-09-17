import { NextResponse } from 'next/server'
import { getPaymentProvider } from '@/services/payment'
import {
  finalizePaidOrder,
  markOrderPaymentFailed,
  resolveOrderIdFromPaymentResult,
} from '@/services/orders'
import { createHash } from 'crypto'
import { absoluteUrl } from '@/lib/utils'
import { getErrorMessage } from '@/lib/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Verified = {
  valid: boolean
  status?: 'paid' | 'failed' | 'pending'
  orderId?: string
  basketId?: string
  token?: string
  providerPaymentId?: string
  amount?: number
  raw?: unknown
}

async function parseCallbackBody(request: Request): Promise<{
  body: string
  token: string | null
  fields: Record<string, string>
}> {
  const contentType = request.headers.get('content-type') || ''
  const fields: Record<string, string> = {}

  if (contentType.includes('application/json')) {
    const text = await request.text()
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>
      for (const [k, v] of Object.entries(parsed)) {
        if (v != null) fields[k] = String(v)
      }
    } catch {
      // keep empty
    }
    return { body: text, token: fields.token || null, fields }
  }

  try {
    const form = await request.formData()
    for (const [k, v] of form.entries()) {
      fields[k] = String(v)
    }
  } catch (err) {
    console.error('[payments/callback] formData parse failed', getErrorMessage(err))
    const text = await request.text().catch(() => '')
    if (text) {
      const params = new URLSearchParams(text)
      for (const [k, v] of params.entries()) fields[k] = v
    }
  }

  const urlToken = new URL(request.url).searchParams.get('token')
  const token = fields.token || urlToken
  return { body: JSON.stringify({ ...fields, token }), token, fields }
}

async function enrichOrderId(verified: Verified): Promise<Verified> {
  if (verified.orderId) return verified

  const raw = verified.raw as { basketId?: string; token?: string } | undefined
  const resolved = await resolveOrderIdFromPaymentResult({
    orderId: verified.orderId,
    basketId: verified.basketId || raw?.basketId,
    token: verified.token || raw?.token,
    providerPaymentId: verified.providerPaymentId,
  })

  console.info('[payments/callback] resolveOrderId', {
    hadOrderId: Boolean(verified.orderId),
    basketId: verified.basketId || raw?.basketId,
    tokenPreview: (verified.token || raw?.token)?.slice(0, 8) ?? null,
    resolved,
  })

  return { ...verified, orderId: resolved || undefined }
}

async function handleVerified(verified: Verified, kind: string) {
  const enriched = await enrichOrderId(verified)

  console.info('[payments/callback] verified', {
    kind,
    valid: enriched.valid,
    status: enriched.status,
    orderId: enriched.orderId,
    basketId: enriched.basketId,
    providerPaymentId: enriched.providerPaymentId,
    amount: enriched.amount,
    rawStatus: (enriched.raw as { paymentStatus?: string } | undefined)?.paymentStatus,
  })

  if (!enriched.valid) {
    console.error('[payments/callback] invalid verification — redirect failure', { kind, enriched })
    return NextResponse.redirect(absoluteUrl('/checkout/failure?reason=invalid'))
  }

  if (!enriched.orderId) {
    console.error('[payments/callback] paid but orderId unresolved', {
      basketId: enriched.basketId,
      token: enriched.token,
      providerPaymentId: enriched.providerPaymentId,
    })
    return NextResponse.redirect(absoluteUrl('/checkout/failure?reason=order_not_found'))
  }

  if (enriched.status === 'failed') {
    const failKey = createHash('sha256')
      .update(`${enriched.providerPaymentId || ''}:${enriched.orderId}:${kind}-fail`)
      .digest('hex')
    try {
      await markOrderPaymentFailed({
        orderId: enriched.orderId,
        providerPaymentId: enriched.providerPaymentId,
        raw: enriched.raw,
        webhookIdempotencyKey: failKey,
      })
    } catch (err) {
      console.error('[payments/callback] markOrderPaymentFailed', getErrorMessage(err))
    }
    return NextResponse.redirect(absoluteUrl('/checkout/failure?reason=payment_failed'))
  }

  if (enriched.status !== 'paid') {
    console.warn('[payments/callback] non-paid status', enriched.status)
    return NextResponse.redirect(absoluteUrl('/checkout/failure?reason=pending'))
  }

  const webhookIdempotencyKey = createHash('sha256')
    .update(`${enriched.providerPaymentId || ''}:${enriched.orderId}:${kind}`)
    .digest('hex')

  try {
    await finalizePaidOrder({
      orderId: enriched.orderId,
      providerPaymentId: enriched.providerPaymentId,
      amount: enriched.amount,
      raw: enriched.raw,
      webhookIdempotencyKey,
    })
    console.info('[payments/callback] finalized', { orderId: enriched.orderId })
    return NextResponse.redirect(absoluteUrl(`/checkout/success?orderId=${enriched.orderId}`))
  } catch (err) {
    console.error('[payments/callback] finalizePaidOrder failed', getErrorMessage(err), err)
    return NextResponse.redirect(absoluteUrl('/checkout/failure?reason=finalize'))
  }
}

/**
 * iyzico Checkout Form return URL.
 * Browser POSTs `token`; we re-verify via CF retrieve (never trust alone).
 */
export async function POST(request: Request) {
  console.info('[payments/callback] POST hit', {
    contentType: request.headers.get('content-type'),
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
  })

  try {
    const { body, token, fields } = await parseCallbackBody(request)
    console.info('[payments/callback] parsed body keys', {
      keys: Object.keys(fields),
      hasToken: Boolean(token),
      tokenPreview: token ? `${token.slice(0, 8)}…` : null,
    })

    if (!token) {
      console.error('[payments/callback] missing token in POST body')
      return NextResponse.redirect(absoluteUrl('/checkout/failure?reason=missing_token'))
    }

    const provider = getPaymentProvider()
    const verified = await provider.verifyWebhook(request.headers, body)
    return handleVerified(verified, 'callback')
  } catch (err) {
    console.error('[payments/callback] POST unhandled', getErrorMessage(err), err)
    return NextResponse.redirect(absoluteUrl('/checkout/failure?reason=exception'))
  }
}

export async function GET(request: Request) {
  console.info('[payments/callback] GET hit', { url: request.url })
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    if (!token) {
      return NextResponse.redirect(absoluteUrl('/checkout/failure?reason=missing_token'))
    }

    const provider = getPaymentProvider()
    const verified = await provider.verifyWebhook(request.headers, JSON.stringify({ token }))
    return handleVerified(
      {
        ...verified,
        providerPaymentId: verified.providerPaymentId || token,
        token: verified.token || token,
      },
      'callback-get'
    )
  } catch (err) {
    console.error('[payments/callback] GET unhandled', getErrorMessage(err), err)
    return NextResponse.redirect(absoluteUrl('/checkout/failure?reason=exception'))
  }
}
