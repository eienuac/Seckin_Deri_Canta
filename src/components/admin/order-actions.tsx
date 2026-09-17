'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import { ORDER_STATUS_LABELS } from '@/lib/labels'

const STATUSES = Object.keys(ORDER_STATUS_LABELS)

export function AdminOrderActions({
  orderId,
  status,
  trackingNumber,
}: {
  orderId: string
  status: string
  trackingNumber?: string | null
}) {
  const router = useRouter()
  const [nextStatus, setNextStatus] = useState(status)
  const [tracking, setTracking] = useState(trackingNumber || '')

  async function save() {
    const res = await fetch('/api/app-admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status: nextStatus, trackingNumber: tracking }),
    })
    const data = await res.json()
    if (!res.ok) toast.error(data.error || 'Kaydedilemedi')
    else {
      toast.success('Sipariş güncellendi')
      router.refresh()
    }
  }

  return (
    <div className="mt-10 max-w-md space-y-4 border border-border p-5">
      <div>
        <Label>Durum</Label>
        <select
          className="mt-1 h-11 w-full border border-border bg-ivory px-3 text-sm"
          value={nextStatus}
          onChange={(e) => setNextStatus(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s] || s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Tracking number</Label>
        <Input value={tracking} onChange={(e) => setTracking(e.target.value)} />
      </div>
      <Button type="button" onClick={save}>
        Kaydet
      </Button>
    </div>
  )
}
