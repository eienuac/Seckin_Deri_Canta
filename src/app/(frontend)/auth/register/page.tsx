'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { toast } from 'sonner'
import { mergeGuestCartAfterAuth } from '@/hooks/use-cart'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            first_name: form.firstName,
            last_name: form.lastName,
          },
        },
      })
      if (error) throw error
      await mergeGuestCartAfterAuth()
      toast.success('Kayıt başarılı')
      router.push('/account')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kayıt başarısız')
    } finally {
      setLoading(false)
    }
  }

  function continueAsGuest() {
    toast.message('Misafir olarak devam ediyorsunuz', {
      description: 'Sepet ve favoriler bu cihazda saklanır.',
    })
    router.push('/products')
  }

  return (
    <div className="container-page flex justify-center py-20">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 border border-border bg-ivory p-8">
        <h1 className="font-display text-3xl text-espresso">Kayıt Ol</h1>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Ad</Label>
            <Input
              required
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </div>
          <div>
            <Label>Soyad</Label>
            <Input
              required
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>E-posta</Label>
          <Input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <Label>Şifre</Label>
          <Input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Kaydediliyor…' : 'Kayıt Ol'}
        </Button>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-[11px] uppercase tracking-[0.16em]">
            <span className="bg-ivory px-3 text-muted">veya</span>
          </div>
        </div>

        <Button type="button" variant="ghost" className="w-full" onClick={continueAsGuest}>
          Misafir olarak devam et
        </Button>

        <p className="text-center text-sm text-muted">
          Zaten hesabınız var mı?{' '}
          <Link href="/auth/login" className="text-espresso underline">
            Giriş yapın
          </Link>
        </p>
      </form>
    </div>
  )
}
