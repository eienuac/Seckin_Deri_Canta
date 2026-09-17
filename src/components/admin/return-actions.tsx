'use client'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const NEXT = ['reviewing', 'approved', 'rejected', 'awaiting_shipment', 'received', 'refunded']

export function ReturnAdminActions({ returnId, status }: { returnId: string; status: string }) {
  const router = useRouter()

  async function setStatus(next: string) {
    const res = await fetch('/api/app-admin/returns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnId, status: next }),
    })
    const data = await res.json()
    if (!res.ok) toast.error(data.error || 'Hata')
    else {
      toast.success('Güncellendi')
      router.refresh()
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {NEXT.filter((s) => s !== status).map((s) => (
        <Button key={s} type="button" size="sm" variant="secondary" onClick={() => setStatus(s)}>
          {s}
        </Button>
      ))}
    </div>
  )
}
