'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function CouponAdminForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    code: '',
    type: 'percent',
    value: 10,
    min_subtotal: 0,
    max_discount: 500,
    usage_limit: 100,
    per_user_limit: 1,
  })

  async function create() {
    const res = await fetch('/api/app-admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) toast.error(data.error || 'Hata')
    else {
      toast.success('Kupon oluşturuldu')
      router.refresh()
    }
  }

  return (
    <div className="mt-10 max-w-md space-y-3 border border-border p-5">
      <h2 className="font-display text-xl">Yeni kupon</h2>
      <div>
        <Label>Kod</Label>
        <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
      </div>
      <div>
        <Label>Tip</Label>
        <select
          className="h-11 w-full border border-border bg-ivory px-3 text-sm"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          <option value="percent">Yüzde</option>
          <option value="fixed">Sabit</option>
        </select>
      </div>
      <div>
        <Label>Değer</Label>
        <Input
          type="number"
          value={form.value}
          onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
        />
      </div>
      <Button type="button" onClick={create}>
        Oluştur
      </Button>
    </div>
  )
}
