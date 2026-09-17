export type CreatePaymentInput = {
  orderId: string
  orderNumber: string
  amount: number
  currency: string
  buyer: {
    id: string
    name: string
    surname: string
    email: string
    phone: string
    identityNumber?: string
    ip: string
    city: string
    country: string
    address: string
  }
  basketItems: Array<{
    id: string
    name: string
    category: string
    price: number
  }>
  callbackUrl: string
}

export type CreatePaymentResult = {
  provider: string
  paymentPageUrl?: string
  token?: string
  providerPaymentId?: string
  raw?: unknown
}

export type WebhookVerificationResult = {
  valid: boolean
  providerPaymentId?: string
  orderId?: string
  /** iyzico basketId — we set this to order_number at initialize */
  basketId?: string
  /** CF token from callback / retrieve */
  token?: string
  status?: 'paid' | 'failed' | 'pending'
  amount?: number
  raw?: unknown
}

export interface PaymentProvider {
  readonly name: string
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>
  verifyWebhook(headers: Headers, body: string): Promise<WebhookVerificationResult>
  refund?(providerPaymentId: string, amount: number): Promise<{ success: boolean }>
}

export class PaymentNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`Payment provider "${provider}" is not configured`)
    this.name = 'PaymentNotConfiguredError'
  }
}
