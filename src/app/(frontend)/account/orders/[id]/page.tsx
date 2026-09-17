'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatPrice } from '@/lib/utils'
import { ORDER_STATUS_LABELS } from '@/lib/labels'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { toast } from 'sonner'
import Link from 'next/link'

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<{
    order: {
      id: string
      order_number: string
      status: string
      payment_status: string
      total: number
      tracking_number?: string | null
      created_at: string
    }
    items: Array<{
      id: string
      product_name_snapshot: string
      product_sku_snapshot: string
      unit_price_snapshot: number
      quantity: number
      product_id: string
    }>
  } | null>(null)
  const [returnOpen, setReturnOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [reviewFor, setReviewFor] = useState<string | null>(null)
  const [rating, setRating] = useState(5)
  const [reviewTitle, setReviewTitle] = useState('')
  const [reviewComment, setReviewComment] = useState('')
  const [reviewedIds, setReviewedIds] = useState<string[]>([])

  useEffect(() => {
    fetch(`/api/account/orders/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) toast.error(d.error)
        else setData(d)
      })
  }, [params.id])

  if (!data) return <div className="skeleton h-60 w-full" />

  async function submitReturn() {
    const item = data!.items[0]
    const res = await fetch('/api/account/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: data!.order.id,
        reason,
        description,
        items: [{ orderItemId: item.id, quantity: item.quantity }],
      }),
    })
    const json = await res.json()
    if (!res.ok) toast.error(json.error || 'İade açılamadı')
    else {
      toast.success('İade talebi oluşturuldu')
      setReturnOpen(false)
    }
  }

  async function submitReview(productId: string) {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId,
        orderId: data!.order.id,
        rating,
        title: reviewTitle || undefined,
        comment: reviewComment || undefined,
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error || 'Yorum eklenemedi')
      return
    }
    toast.success('Yorumunuz onay için gönderildi')
    setReviewedIds((ids) => [...ids, productId])
    setReviewFor(null)
    setReviewTitle('')
    setReviewComment('')
    setRating(5)
  }

  return (
    <div>
      <Link href="/account/orders" className="text-xs uppercase tracking-widest text-muted">
        ← Siparişler
      </Link>
      <h2 className="mt-4 font-display text-3xl text-espresso">{data.order.order_number}</h2>
      <p className="mt-2 text-sm text-muted">
        {ORDER_STATUS_LABELS[data.order.status] || data.order.status} · Ödeme:{' '}
        {data.order.payment_status}
      </p>
      {data.order.tracking_number && (
        <p className="mt-1 text-sm">Takip no: {data.order.tracking_number}</p>
      )}

      <ul className="mt-8 divide-y divide-border border-y border-border">
        {data.items.map((item) => (
          <li key={item.id} className="py-4 text-sm">
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-espresso">{item.product_name_snapshot}</p>
                <p className="text-xs text-muted">
                  {item.product_sku_snapshot} × {item.quantity}
                </p>
              </div>
              <p>{formatPrice(Number(item.unit_price_snapshot) * item.quantity)}</p>
            </div>
            {data.order.status === 'delivered' && !reviewedIds.includes(item.product_id) && (
              <div className="mt-3">
                {reviewFor === item.product_id ? (
                  <div className="max-w-md space-y-3 border border-border p-4">
                    <div>
                      <Label>Puan (1–5)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Başlık</Label>
                      <Input value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} />
                    </div>
                    <div>
                      <Label>Yorum</Label>
                      <Textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" onClick={() => submitReview(item.product_id)}>
                        Gönder
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setReviewFor(null)}>
                        İptal
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setReviewFor(item.product_id)}
                  >
                    Yorum yaz
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-right text-lg">{formatPrice(Number(data.order.total))}</p>

      {data.order.status === 'delivered' ? (
        <div className="mt-8">
          {!returnOpen ? (
            <Button type="button" variant="secondary" onClick={() => setReturnOpen(true)}>
              İade talebi aç
            </Button>
          ) : (
            <div className="max-w-md space-y-3 border border-border p-4">
              <div>
                <Label>Sebep</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div>
                <Label>Açıklama</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <Button type="button" onClick={submitReturn}>
                Gönder
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted">
          Yorum ve iade, sipariş <strong>Teslim Edildi</strong> olduktan sonra açılır. Şu anki durum:{' '}
          {ORDER_STATUS_LABELS[data.order.status] || data.order.status}.
        </p>
      )}
    </div>
  )
}
