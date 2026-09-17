'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'

const LINKS = [
  { href: '/account', label: 'Profil' },
  { href: '/account/orders', label: 'Siparişler' },
  { href: '/account/addresses', label: 'Adresler' },
  { href: '/account/favorites', label: 'Favoriler' },
  { href: '/account/returns', label: 'İadeler' },
  { href: '/account/security', label: 'Güvenlik' },
]

const GUEST_ALLOWED = ['/account/favorites']

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const pathname = usePathname()
  const guestOk = GUEST_ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const [isAppAdmin, setIsAppAdmin] = useState(false)

  useEffect(() => {
    if (!user) {
      setIsAppAdmin(false)
      return
    }
    fetch('/api/account/me')
      .then((r) => r.json())
      .then((d) => setIsAppAdmin(Boolean(d.isAppAdmin)))
      .catch(() => setIsAppAdmin(false))
  }, [user])

  if (loading) {
    return (
      <div className="container-page py-16">
        <div className="skeleton h-40 w-full" />
      </div>
    )
  }

  if (!user && guestOk) {
    return (
      <div className="container-page py-10 md:py-14">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl text-espresso">Favoriler</h1>
          <div className="flex gap-3">
            <Link href="/auth/login">
              <Button variant="secondary">Giriş Yap</Button>
            </Link>
            <Link href="/auth/register">
              <Button>Kayıt Ol</Button>
            </Link>
          </div>
        </div>
        {children}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container-page flex flex-col items-center py-24 text-center">
        <h1 className="font-display text-4xl text-espresso">Hesabım</h1>
        <p className="mt-3 text-muted">Sipariş ve favorileriniz için giriş yapın.</p>
        <div className="mt-8 flex gap-3">
          <Link href="/auth/login">
            <Button>Giriş Yap</Button>
          </Link>
          <Link href="/auth/register">
            <Button variant="secondary">Kayıt Ol</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container-page grid gap-10 py-10 md:grid-cols-[220px_1fr] md:py-14">
      <aside>
        <h1 className="font-display text-3xl text-espresso">Hesabım</h1>
        <nav className="mt-6 flex flex-col gap-2">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-muted hover:text-espresso">
              {l.label}
            </Link>
          ))}
          {isAppAdmin && (
            <Link
              href="/app-admin"
              className="mt-2 text-sm font-medium text-espresso hover:underline"
            >
              Operasyon paneli
            </Link>
          )}
          <button
            type="button"
            onClick={() => signOut()}
            className="mt-4 text-left text-sm text-danger"
          >
            Çıkış Yap
          </button>
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  )
}
