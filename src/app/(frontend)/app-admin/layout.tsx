import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAppAdmin } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

const NAV = [
  { href: '/app-admin', label: 'Özet' },
  { href: '/app-admin/orders', label: 'Siparişler' },
  { href: '/app-admin/users', label: 'Kullanıcılar' },
  { href: '/app-admin/inventory', label: 'Stok' },
  { href: '/app-admin/coupons', label: 'Kuponlar' },
  { href: '/app-admin/returns', label: 'İadeler' },
  { href: '/app-admin/reviews', label: 'Yorumlar' },
]

export default async function AppAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAppAdmin()

  if (!admin) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/auth/login?next=/app-admin')
    }

    return (
      <div className="container-page flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
        <h1 className="font-display text-4xl text-espresso">Yetki yok</h1>
        <p className="mt-4 max-w-md text-muted">
          Bu hesap operasyon paneline erişemiyor. Giriş yaptığınız e-posta:{' '}
          <strong className="text-espresso">{user.email}</strong>
        </p>
        <p className="mt-3 max-w-lg text-sm text-muted">
          Çözüm: <code className="text-espresso">.env.local</code> içinde{' '}
          <code className="text-espresso">ADMIN_EMAILS</code> satırına bu e-postayı ekleyin, veya
          terminalde çalıştırın:
        </p>
        <pre className="mt-4 max-w-full overflow-x-auto border border-border bg-ivory px-4 py-3 text-left text-xs text-espresso">
          {`npx tsx scripts/promote-admin.mts ${user.email}`}
        </pre>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/account">
            <Button variant="secondary">Hesabıma dön</Button>
          </Link>
          <Link href="/">
            <Button>Mağaza</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-border bg-ivory">
        <div className="container-page flex flex-col gap-4 py-4 md:flex-row md:h-16 md:items-center md:justify-between md:py-0">
          <div className="flex items-center justify-between gap-4">
            <Link href="/app-admin" className="font-display text-2xl text-espresso">
              Seçkin Çanta · Operasyon
            </Link>
            <Link href="/admin" className="text-xs uppercase tracking-widest text-muted md:hidden">
              CMS
            </Link>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-espresso hover:underline">
                {item.label}
              </Link>
            ))}
            <Link href="/admin" className="hidden text-muted hover:underline md:inline">
              CMS (Ürünler)
            </Link>
            <Link href="/" className="text-muted hover:underline">
              Mağaza
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
