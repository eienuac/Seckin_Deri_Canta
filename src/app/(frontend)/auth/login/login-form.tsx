'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { toast } from 'sonner'
import { mergeGuestCartAfterAuth } from '@/hooks/use-cart'

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/products'
  return raw
}

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = safeNextPath(searchParams.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      await mergeGuestCartAfterAuth()
      toast.success('Giriş başarılı')
      router.push(nextPath === '/products' ? '/account' : nextPath)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Giriş başarısız')
    } finally {
      setLoading(false)
    }
  }

  async function google() {
    const supabase = createClient()
    const redirectTo = new URL('/auth/callback', window.location.origin)
    redirectTo.searchParams.set('next', nextPath === '/products' ? '/account' : nextPath)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo.toString() },
    })
  }

  function continueAsGuest() {
    toast.message('Misafir olarak devam ediyorsunuz', {
      description: 'Sepet ve favoriler bu cihazda saklanır. İstediğiniz zaman giriş yapabilirsiniz.',
    })
    // Admin routes require auth — never dump guests onto /app-admin
    router.push(nextPath.startsWith('/app-admin') ? '/products' : nextPath)
  }

  return (
    <div className="container-page flex justify-center py-20">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 border border-border bg-ivory p-8">
        <h1 className="font-display text-3xl text-espresso">Giriş Yap</h1>
        <p className="text-sm text-muted">
          Hesabınızla giriş yapın veya misafir olarak alışverişe devam edin.
        </p>
        <div>
          <Label>E-posta</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label>Şifre</Label>
          <Input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
        </Button>
        <Button type="button" variant="secondary" className="w-full" onClick={google}>
          Google ile devam et
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
        <p className="text-center text-xs text-muted">
          Misafir sepette ürün ekleyebilir; ödeme sırasında e-posta istenebilir.
        </p>

        <p className="text-center text-sm text-muted">
          Hesabınız yok mu?{' '}
          <Link
            href={`/auth/register${nextPath !== '/products' ? `?next=${encodeURIComponent(nextPath)}` : ''}`}
            className="text-espresso underline"
          >
            Kayıt olun
          </Link>
        </p>
      </form>
    </div>
  )
}
