'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function SecurityPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [password, setPassword] = useState('')

  async function changePassword() {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) toast.error(error.message)
    else {
      toast.success('Şifre güncellendi')
      setPassword('')
    }
  }

  async function deleteAccount() {
    if (!confirm('Hesabınızı silmek istediğinize emin misiniz?')) return
    const res = await fetch('/api/account/delete', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) toast.error(data.error || 'Silinemedi')
    else {
      toast.success('Hesap silindi')
      router.push('/')
    }
  }

  return (
    <div>
      <h2 className="font-display text-3xl text-espresso">Güvenlik</h2>
      <p className="mt-2 text-sm text-muted">{user?.email}</p>
      <div className="mt-8 max-w-md space-y-3">
        <div>
          <Label>Yeni şifre</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="button" onClick={changePassword}>
          Şifreyi değiştir
        </Button>
        <div className="border-t border-border pt-6">
          <Button type="button" variant="danger" onClick={deleteAccount}>
            Hesabı sil
          </Button>
        </div>
      </div>
    </div>
  )
}
