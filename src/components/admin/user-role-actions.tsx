'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function UserRoleActions({
  userId,
  role,
}: {
  userId: string
  role: 'customer' | 'admin' | string
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const nextRole = role === 'admin' ? 'customer' : 'admin'

  async function toggle() {
    setSaving(true)
    try {
      const res = await fetch('/api/app-admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: nextRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Güncellenemedi')
      toast.success(nextRole === 'admin' ? 'Admin yapıldı' : 'Müşteri yapıldı')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={toggle}>
      {role === 'admin' ? 'Müşteri yap' : 'Admin yap'}
    </Button>
  )
}
