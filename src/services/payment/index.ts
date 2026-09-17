import type { PaymentProvider } from './types'
import { IyzicoPaymentProvider } from './iyzico'
import { PaymentNotConfiguredError } from './types'

class UnconfiguredProvider implements PaymentProvider {
  readonly name = 'none'
  async createPayment(_input: import('./types').CreatePaymentInput): Promise<import('./types').CreatePaymentResult> {
    throw new PaymentNotConfiguredError('none')
  }
  async verifyWebhook() {
    return { valid: false }
  }
}

export function getPaymentProvider(): PaymentProvider {
  const provider = (process.env.PAYMENT_PROVIDER || 'iyzico').toLowerCase()
  if (provider === 'iyzico') {
    return new IyzicoPaymentProvider()
  }
  return new UnconfiguredProvider()
}

export * from './types'
