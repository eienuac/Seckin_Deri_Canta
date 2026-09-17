'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { useCart } from '@/hooks/use-cart'
import { SearchDialog } from '@/components/layout/search-dialog'
import { cn } from '@/lib/utils'

const STATIC_LINKS = [
  { href: '/products?gender=men', label: 'Erkek' },
  { href: '/products?gender=women', label: 'Kadın' },
  { href: '/products?category=canta', label: 'Çantalar' },
  { href: '/products?category=cuzdan', label: 'Cüzdanlar' },
  { href: '/products?sort=newest', label: 'Yeni Gelenler' },
  { href: '/products?sort=price-asc&inStock=true', label: 'İndirim' },
]

export function SiteHeader({
  categories = [],
}: {
  categories?: Array<{ name: string; slug: string; parentId?: number | null }>
}) {
  const { itemCount } = useCart()
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const dynamicLinks =
    categories.filter((c) => !c.parentId).length > 0
      ? categories
          .filter((c) => !c.parentId)
          .slice(0, 6)
          .map((c) => ({ href: `/products?category=${c.slug}`, label: c.name }))
      : STATIC_LINKS

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 border-b transition-colors',
          scrolled ? 'border-border/80 bg-cream/95 backdrop-blur' : 'border-transparent bg-cream'
        )}
      >
        <div className="container-page grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 md:h-20">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center md:hidden"
              aria-label="Menü"
              onClick={() => setOpen(true)}
            >
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <Link href="/" className="font-display text-xl tracking-[0.04em] text-espresso md:text-2xl">
              Seçkin Çanta
            </Link>
          </div>

          <nav className="hidden items-center gap-7 md:flex">
            {dynamicLinks.map((link) => (
              <Link
                key={link.href + link.label}
                href={link.href}
                className="text-[12px] uppercase tracking-[0.18em] text-espresso/80 transition hover:text-espresso"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center justify-end gap-1 sm:gap-2">
            <button
              type="button"
              aria-label="Ara"
              className="inline-flex h-10 w-10 items-center justify-center"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <Link href="/account" aria-label="Hesap" className="hidden h-10 w-10 items-center justify-center sm:inline-flex">
              <User className="h-5 w-5" strokeWidth={1.5} />
            </Link>
            <Link href="/account/favorites" aria-label="Favoriler" className="hidden h-10 w-10 items-center justify-center sm:inline-flex">
              <Heart className="h-5 w-5" strokeWidth={1.5} />
            </Link>
            <Link href="/cart" aria-label="Sepet" className="relative inline-flex h-10 w-10 items-center justify-center">
              <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
              {itemCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center bg-espresso px-1 text-[10px] text-ivory">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button type="button" className="absolute inset-0 bg-espresso/40" aria-label="Kapat" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[84%] max-w-sm flex-col bg-cream p-6 shadow-xl">
            <div className="mb-8 flex items-center justify-between">
              <span className="font-display text-xl">Menü</span>
              <button type="button" aria-label="Kapat" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-5">
              {dynamicLinks.map((link) => (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  className="text-lg text-espresso"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/account" onClick={() => setOpen(false)} className="mt-4 text-sm uppercase tracking-widest text-muted">
                Hesabım
              </Link>
            </nav>
          </aside>
        </div>
      )}

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
