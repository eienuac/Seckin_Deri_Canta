import Link from 'next/link'

const CUSTOMER = [
  { href: '/account/orders', label: 'Siparişlerim' },
  { href: '/pages/kargo-ve-teslimat', label: 'Kargo ve Teslimat' },
  { href: '/pages/iade-ve-degisim', label: 'İade ve Değişim' },
  { href: '/pages/sss', label: 'SSS' },
]

const LEGAL = [
  { href: '/pages/kvkk', label: 'KVKK' },
  { href: '/pages/gizlilik-politikasi', label: 'Gizlilik Politikası' },
  { href: '/pages/cerez-politikasi', label: 'Çerez Politikası' },
  { href: '/pages/kullanim-kosullari', label: 'Kullanım Koşulları' },
  { href: '/pages/mesafeli-satis-sozlesmesi', label: 'Mesafeli Satış Sözleşmesi' },
]

export function SiteFooter({
  brandName = 'Seçkin Çanta',
  tagline = 'Zamansız deri.',
  social,
}: {
  brandName?: string
  tagline?: string
  social?: { instagram?: string | null; facebook?: string | null; pinterest?: string | null }
}) {
  return (
    <footer className="mt-24 border-t border-border bg-ivory">
      <div className="container-page grid gap-12 py-16 md:grid-cols-4">
        <div className="md:col-span-1">
          <p className="font-display text-2xl text-espresso">{brandName}</p>
          <p className="mt-3 max-w-xs text-sm text-muted">{tagline}</p>
          <div className="mt-6 flex gap-4 text-sm text-espresso">
            {social?.instagram && (
              <a href={social.instagram} target="_blank" rel="noreferrer">
                Instagram
              </a>
            )}
            {social?.facebook && (
              <a href={social.facebook} target="_blank" rel="noreferrer">
                Facebook
              </a>
            )}
            {social?.pinterest && (
              <a href={social.pinterest} target="_blank" rel="noreferrer">
                Pinterest
              </a>
            )}
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Keşfet</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/pages/hakkimizda">Hakkımızda</Link></li>
            <li><Link href="/pages/iletisim">İletişim</Link></li>
            <li><Link href="/pages/magazalar">Mağazalar</Link></li>
            <li><Link href="/products">Koleksiyon</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Müşteri Hizmetleri</p>
          <ul className="mt-4 space-y-2 text-sm">
            {CUSTOMER.map((l) => (
              <li key={l.href}><Link href={l.href}>{l.label}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Yasal</p>
          <ul className="mt-4 space-y-2 text-sm">
            {LEGAL.map((l) => (
              <li key={l.href}><Link href={l.href}>{l.label}</Link></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-6 py-10 md:flex-row md:items-end md:justify-between">
          <form action="/api/newsletter" method="post" className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
            <input
              name="email"
              type="email"
              required
              placeholder="E-posta adresiniz"
              className="h-11 flex-1 border border-border bg-cream px-3 text-sm outline-none focus:ring-2 focus:ring-leather/20"
            />
            <button type="submit" className="h-11 bg-espresso px-5 text-xs uppercase tracking-widest text-ivory">
              Abone Ol
            </button>
          </form>
          <p className="text-xs text-muted">© {new Date().getFullYear()} {brandName}. Tüm hakları saklıdır.</p>
        </div>
      </div>
    </footer>
  )
}
