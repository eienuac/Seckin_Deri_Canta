/**
 * Shipping abstraction — manual rates now; swap for cargo API later.
 */
export type ShippingMethod = 'standard' | 'express'

export type ShippingQuote = {
  method: ShippingMethod
  label: string
  cost: number
  eta: string
}

const FREE_SHIPPING_THRESHOLD = 3000

export function calculateShipping(input: {
  method: ShippingMethod
  subtotal: number
}): ShippingQuote {
  if (input.method === 'express') {
    return {
      method: 'express',
      label: 'Hızlı Kargo',
      cost: 149.9,
      eta: '1-2 iş günü',
    }
  }

  const cost = input.subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 79.9
  return {
    method: 'standard',
    label: 'Standart Kargo',
    cost,
    eta: '2-4 iş günü',
  }
}

export function listShippingMethods(subtotal: number): ShippingQuote[] {
  return [
    calculateShipping({ method: 'standard', subtotal }),
    calculateShipping({ method: 'express', subtotal }),
  ]
}

export interface ShippingProvider {
  createShipment(orderId: string): Promise<{ trackingNumber: string }>
  track(trackingNumber: string): Promise<{ status: string }>
}

/** Placeholder for future Yurtiçi/Aras/MNG integration */
export class ManualShippingProvider implements ShippingProvider {
  async createShipment(_orderId: string): Promise<{ trackingNumber: string }> {
    throw new Error('Manual shipping — tracking assigned by admin')
  }
  async track(trackingNumber: string) {
    return { status: `Manuel takip: ${trackingNumber}` }
  }
}
