'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { ORDER_STATUS_LABELS } from '@/lib/labels'

type Order = {
  id: string
  order_number: string
  created_at: string
  total: number
  status: string
  payment_status: string
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/account/orders')
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="skeleton h-40 w-full" />

  return (
    <div>
      <h2 className="font-display text-3xl text-espresso">Siparişler</h2>
      {orders.length === 0 ? (
        <p className="mt-6 text-muted">Henüz siparişiniz yok.</p>
      ) : (
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-5">
              <div>
                <Link href={`/account/orders/${o.id}`} className="font-medium text-espresso">
                  {o.order_number}
                </Link>
                <p className="text-xs text-muted">
                  {new Date(o.created_at).toLocaleDateString('tr-TR')} ·{' '}
                  {ORDER_STATUS_LABELS[o.status] || o.status}
                </p>
              </div>
              <p>{formatPrice(Number(o.total))}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
