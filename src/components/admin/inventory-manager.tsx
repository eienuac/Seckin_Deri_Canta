'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

type Row = {
  id: string
  sku: string
  product_id: string
  variant_id: string | null
  quantity: number
  reserved_quantity: number
}

export function InventoryManager({ rows }: { rows: Row[] }) {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Record<string, number>>(
    Object.fromEntries(rows.map((r) => [r.id, r.quantity]))
  )

  async function save(id: string) {
    const res = await fetch('/api/app-admin/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, quantity: drafts[id] }),
    })
    const data = await res.json()
    if (!res.ok) toast.error(data.error || 'Hata')
    else {
      toast.success('Stok güncellendi')
      router.refresh()
    }
  }

  return (
    <div className="mt-8 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-widest text-muted">
            <th className="py-3">SKU</th>
            <th>Ürün ID</th>
            <th>Varyant</th>
            <th>Stok</th>
            <th>Rezerve</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border">
              <td className="py-3">{row.sku}</td>
              <td>{row.product_id}</td>
              <td>{row.variant_id || '—'}</td>
              <td>
                <Input
                  type="number"
                  className="h-9 w-24"
                  value={drafts[row.id] ?? row.quantity}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [row.id]: Number(e.target.value) }))
                  }
                />
              </td>
              <td>{row.reserved_quantity}</td>
              <td>
                <Button type="button" size="sm" onClick={() => save(row.id)}>
                  Kaydet
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
