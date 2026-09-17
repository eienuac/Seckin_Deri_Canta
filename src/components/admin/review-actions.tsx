'use client'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function ReviewAdminActions({ reviewId, approved }: { reviewId: string; approved: boolean }) {
  const router = useRouter()

  async function setApproved(next: boolean) {
    const res = await fetch('/api/app-admin/reviews', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewId, isApproved: next }),
    })
    const data = await res.json()
    if (!res.ok) toast.error(data.error || 'Hata')
    else {
      toast.success('Güncellendi')
      router.refresh()
    }
  }

  return (
    <div className="mt-3 flex gap-2">
      {!approved && (
        <Button type="button" size="sm" onClick={() => setApproved(true)}>
          Onayla
        </Button>
      )}
      <Button type="button" size="sm" variant="secondary" onClick={() => setApproved(false)}>
        Gizle
      </Button>
    </div>
  )
}
