import {
  type CreatePaymentInput,
  type CreatePaymentResult,
  type PaymentProvider,
  type WebhookVerificationResult,
  PaymentNotConfiguredError,
} from './types'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

type AuthParts = {
  headers: {
    Authorization: string
    'x-iyzi-rnd': string
    'Content-Type': string
  }
  debug: {
    randomKey: string
    signaturePreview: string
    path: string
    bodyLength: number
  }
}

/**
 * iyzico Checkout Form integration (IYZWSv2 HMAC-SHA256).
 * Signature MUST be hex-encoded (not base64) — see:
 * https://docs.iyzico.com/en/getting-started/preliminaries/authentication/hmacsha256-auth
 */
export class IyzicoPaymentProvider implements PaymentProvider {
  readonly name = 'iyzico'

  private get credentials() {
    const apiKey = process.env.PAYMENT_API_KEY?.trim()
    const secretKey = process.env.PAYMENT_SECRET_KEY?.trim()
    const baseUrl = (
      process.env.IYZICO_BASE_URL?.trim() || 'https://sandbox-api.iyzipay.com'
    ).replace(/\/$/, '')
    if (!apiKey || !secretKey) {
      throw new PaymentNotConfiguredError(this.name)
    }
    return { apiKey, secretKey, baseUrl }
  }

  /**
   * IYZWSv2:
   * signature = hex(HMAC_SHA256(secretKey, randomKey + uriPath + requestBody))
   * Authorization = "IYZWSv2 " + base64("apiKey:...&randomKey:...&signature:...")
   */
  private buildAuth(path: string, body: string): AuthParts {
    const { apiKey, secretKey } = this.credentials
    const randomKey = `${Date.now()}${randomBytes(8).toString('hex')}`
    const payloadToSign = `${randomKey}${path}${body}`
    const signature = createHmac('sha256', secretKey).update(payloadToSign, 'utf8').digest('hex')

    const authorizationString = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`
    const authorization = Buffer.from(authorizationString, 'utf8').toString('base64')

    return {
      headers: {
        Authorization: `IYZWSv2 ${authorization}`,
        'x-iyzi-rnd': randomKey,
        'Content-Type': 'application/json',
      },
      debug: {
        randomKey,
        signaturePreview: `${signature.slice(0, 16)}…`,
        path,
        bodyLength: Buffer.byteLength(body, 'utf8'),
      },
    }
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    if (digits.startsWith('90') && digits.length >= 12) return `+${digits}`
    if (digits.startsWith('0') && digits.length === 11) return `+90${digits.slice(1)}`
    if (digits.length === 10) return `+90${digits}`
    return phone.startsWith('+') ? phone : `+${digits || phone}`
  }

  /**
   * iyzico requires every basketItem.price > 0 and sum(prices) === paidPrice.
   * Naive "adjust last item" breaks when a coupon discount exceeds the last line (shipping).
   */
  private alignBasketToPaidPrice(
    basketItems: Array<{ id: string; price: string }>,
    paidPrice: number
  ) {
    if (!basketItems.length) return

    const sum = basketItems.reduce((s, i) => s + Number(i.price), 0)
    if (Math.abs(sum - paidPrice) <= 0.001) return
    if (sum <= 0 || paidPrice <= 0) {
      throw new Error('Ödeme tutarı veya sepet tutarı geçersiz')
    }

    const factor = paidPrice / sum
    let allocated = 0
    for (let i = 0; i < basketItems.length; i++) {
      const item = basketItems[i]!
      if (i === basketItems.length - 1) {
        const remainder = Math.round((paidPrice - allocated) * 100) / 100
        if (remainder <= 0) {
          throw new Error('Kupon sonrası sepet kalemi geçersiz tutar')
        }
        item.price = remainder.toFixed(2)
      } else {
        const next = Math.max(0.01, Math.round(Number(item.price) * factor * 100) / 100)
        item.price = next.toFixed(2)
        allocated += next
      }
    }

    // Guard: if rounding left last item ok but sum drifted, nudge largest product line
    const finalSum = basketItems.reduce((s, i) => s + Number(i.price), 0)
    if (Math.abs(finalSum - paidPrice) > 0.001) {
      const targetIdx =
        basketItems.findIndex((i) => !i.id.startsWith('shipping-')) >= 0
          ? basketItems.findIndex((i) => !i.id.startsWith('shipping-'))
          : 0
      const others = finalSum - Number(basketItems[targetIdx]!.price)
      const fixed = Math.round((paidPrice - others) * 100) / 100
      if (fixed <= 0) throw new Error('Kupon sonrası sepet kalemi geçersiz tutar')
      basketItems[targetIdx]!.price = fixed.toFixed(2)
    }
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const { baseUrl, apiKey, secretKey } = this.credentials
    const path = '/payment/iyzipos/checkoutform/initialize/auth/ecom'

    const basketItems = input.basketItems
      .filter((item) => Number(item.price) > 0)
      .map((item) => ({
        id: item.id,
        name: item.name.slice(0, 120),
        category1: item.category || 'Deri',
        itemType: 'PHYSICAL' as const,
        price: Number(item.price).toFixed(2),
      }))
    const paidPrice = Number(input.amount).toFixed(2)
    // Coupons: paidPrice < sum(line totals). Scale all lines proportionally so
    // no single line (esp. shipping) goes ≤ 0 — iyzico rejects that.
    this.alignBasketToPaidPrice(basketItems, Number(paidPrice))

    const payload = {
      locale: 'tr',
      conversationId: input.orderId,
      price: paidPrice,
      paidPrice,
      currency: input.currency || 'TRY',
      basketId: input.orderNumber,
      paymentGroup: 'PRODUCT',
      callbackUrl: input.callbackUrl,
      enabledInstallments: [1, 2, 3, 6, 9],
      buyer: {
        id: String(input.buyer.id).slice(0, 20),
        name: input.buyer.name,
        surname: input.buyer.surname,
        gsmNumber: this.normalizePhone(input.buyer.phone),
        email: input.buyer.email,
        identityNumber: input.buyer.identityNumber || '11111111111',
        registrationAddress: input.buyer.address,
        ip: input.buyer.ip || '85.34.78.112',
        city: input.buyer.city,
        country: input.buyer.country || 'Turkey',
      },
      shippingAddress: {
        contactName: `${input.buyer.name} ${input.buyer.surname}`,
        city: input.buyer.city,
        country: input.buyer.country || 'Turkey',
        address: input.buyer.address,
      },
      billingAddress: {
        contactName: `${input.buyer.name} ${input.buyer.surname}`,
        city: input.buyer.city,
        country: input.buyer.country || 'Turkey',
        address: input.buyer.address,
      },
      basketItems,
    }

    const body = JSON.stringify(payload)
    const { headers, debug } = this.buildAuth(path, body)

    console.info('[iyzico.createPayment] request', {
      baseUrl,
      apiKeyPreview: `${apiKey.slice(0, 14)}…`,
      secretKeyLength: secretKey.length,
      secretKeyPrefix: secretKey.startsWith('sandbox-') ? 'sandbox-' : 'live?',
      signatureEncoding: 'hex',
      ...debug,
      paidPrice,
      basketCount: basketItems.length,
      callbackUrl: input.callbackUrl,
      buyerPhone: payload.buyer.gsmNumber,
    })

    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body,
    })

    const raw = await res.json().catch(() => ({}))
    if (!res.ok || raw.status !== 'success') {
      console.error('[iyzico.createPayment] failure', {
        httpStatus: res.status,
        status: raw.status,
        errorCode: raw.errorCode,
        errorMessage: raw.errorMessage,
        locale: raw.locale,
        systemTime: raw.systemTime,
        conversationId: raw.conversationId,
        authScheme: 'IYZWSv2',
        signatureEncoding: 'hex',
        apiKeyPreview: `${apiKey.slice(0, 14)}…`,
        secretKeyLength: secretKey.length,
        ...debug,
      })
      throw new Error(raw.errorMessage || raw.errorCode || 'iyzico payment init failed')
    }

    console.info('[iyzico.createPayment] success', {
      conversationId: raw.conversationId,
      hasToken: Boolean(raw.token),
      hasPaymentPageUrl: Boolean(raw.paymentPageUrl),
    })

    return {
      provider: this.name,
      paymentPageUrl: raw.paymentPageUrl,
      token: raw.token,
      providerPaymentId: raw.token,
      raw,
    }
  }

  async verifyWebhook(headers: Headers, body: string): Promise<WebhookVerificationResult> {
    const signature = headers.get('x-iyzico-signature') || headers.get('x-payment-signature')

    // Checkout Form callback: body contains token → must retrieve from iyzico API
    try {
      const parsed = JSON.parse(body) as {
        token?: string
        conversationId?: string
        paymentStatus?: string
        paidPrice?: string | number
      }

      if (!signature && parsed.token) {
        const retrieved = await this.retrieveCheckoutForm(parsed.token)
        console.info('[iyzico.verifyWebhook] CF retrieve', {
          apiStatus: retrieved.status,
          paymentStatus: retrieved.paymentStatus,
          errorCode: retrieved.errorCode,
          errorMessage: retrieved.errorMessage,
          conversationId: retrieved.conversationId,
          paymentId: retrieved.paymentId,
          paidPrice: retrieved.paidPrice,
          mdStatus: retrieved.mdStatus,
          fraudStatus: retrieved.fraudStatus,
        })

        const conversationId = retrieved.conversationId
          ? String(retrieved.conversationId)
          : parsed.conversationId
            ? String(parsed.conversationId)
            : undefined
        const basketId = retrieved.basketId ? String(retrieved.basketId) : undefined
        const token = String(retrieved.token || parsed.token || '')
        const paymentStatus = String(retrieved.paymentStatus || '').toUpperCase()
        const apiOk = retrieved.status === 'success'
        const paid = paymentStatus === 'SUCCESS'
        const failed =
          paymentStatus === 'FAILURE' ||
          paymentStatus === 'FAILED' ||
          retrieved.status === 'failure'

        // iyzico CF retrieve often omits conversationId even when payment succeeded.
        // Treat SUCCESS + token/basketId as valid; resolve orderId via basketId/token in callback.
        return {
          valid: Boolean(apiOk || failed) && (paid || failed || Boolean(token)),
          providerPaymentId: retrieved.paymentId ? String(retrieved.paymentId) : token || undefined,
          orderId: conversationId,
          basketId,
          token: token || undefined,
          status: paid ? 'paid' : failed ? 'failed' : 'pending',
          amount: retrieved.paidPrice != null ? Number(retrieved.paidPrice) : undefined,
          raw: retrieved,
        }
      }
    } catch (err) {
      console.error('[iyzico.verifyWebhook] token retrieve failed', err)
      return { valid: false }
    }

    const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim() || process.env.PAYMENT_SECRET_KEY?.trim()
    if (!secret || !signature) {
      console.warn('[iyzico.verifyWebhook] missing secret or signature for signed webhook')
      return { valid: false }
    }

    const expected = createHmac('sha256', secret).update(body).digest('hex')
    const a = Buffer.from(signature)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      console.error('[iyzico.verifyWebhook] signature mismatch')
      return { valid: false }
    }

    const parsed = JSON.parse(body) as {
      conversationId?: string
      paymentStatus?: string
      token?: string
      paidPrice?: string
      paymentId?: string
    }
    const paymentStatus = String(parsed.paymentStatus || '').toUpperCase()

    return {
      valid: true,
      providerPaymentId: parsed.paymentId || parsed.token,
      orderId: parsed.conversationId,
      status: paymentStatus === 'SUCCESS' ? 'paid' : 'failed',
      amount: parsed.paidPrice ? Number(parsed.paidPrice) : undefined,
      raw: parsed,
    }
  }

  private async retrieveCheckoutForm(token: string) {
    const { baseUrl } = this.credentials
    const path = '/payment/iyzipos/checkoutform/auth/ecom/detail'
    const body = JSON.stringify({ locale: 'tr', token })
    const { headers } = this.buildAuth(path, body)
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body,
    })
    const raw = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('[iyzico.retrieveCheckoutForm] http error', { httpStatus: res.status, raw })
    }
    return raw
  }
}
