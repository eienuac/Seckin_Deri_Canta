import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getOrderById } from '@/services/orders'
import { formatPrice } from '@/lib/utils'
import { ORDER_STATUS_LABELS } from '@/lib/labels'

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>
}) {
  const { orderId } = await searchParams
  const detail = orderId ? await getOrderById(orderId).catch(() => null) : null
  const order = detail?.order
  const items = detail?.items ?? []

  return (
    <div className="container-page py-24 text-center">
      <h1 className="font-display text-4xl text-espresso">Siparişiniz alındı</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">
        Ödemeniz doğrulandı. Sipariş detaylarını hesabınızdan takip edebilirsiniz.
      </p>
      {order && (
        <div className="mx-auto mt-8 max-w-md border border-border bg-ivory p-6 text-left text-sm">
          <p>
            <span className="text-muted">Sipariş no:</span>{' '}
            <span className="font-medium text-espresso">{order.order_number}</span>
          </p>
          <p className="mt-2">
            <span className="text-muted">Durum:</span>{' '}
            {ORDER_STATUS_LABELS[order.status] || order.status}
          </p>
          <p className="mt-2">
            <span className="text-muted">Toplam:</span> {formatPrice(Number(order.total))}
          </p>
          {items.length > 0 && (
            <ul className="mt-4 space-y-1 border-t border-border pt-4">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span>
                    {item.product_name_snapshot} × {item.quantity}
                  </span>
                  <span>
                    {formatPrice(Number(item.unit_price_snapshot) * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!order && orderId && (
        <p className="mt-2 text-sm text-muted">Sipariş ID: {orderId}</p>
      )}
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/account/orders">
          <Button>Siparişlerim</Button>
        </Link>
        <Link href="/products">
          <Button variant="secondary">Alışverişe devam</Button>
        </Link>
      </div>
    </div>
  )
}
