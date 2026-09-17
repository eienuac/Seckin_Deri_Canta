'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/utils'

type Suggestion = {
  products: Array<{
    id: string
    name: string
    slug: string
    price: number
    primaryImage: string | null
  }>
  categories: Array<{ name: string; slug: string }>
}

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [q, setQ] = useState('')
  const [data, setData] = useState<Suggestion | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) return
    if (q.trim().length < 2) {
      setData(null)
      return
    }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const json = await res.json()
        setData(json)
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => clearTimeout(t)
  }, [q, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70]">
      <button type="button" className="absolute inset-0 bg-espresso/50" aria-label="Kapat" onClick={() => onOpenChange(false)} />
      <div className="relative mx-auto mt-16 w-[min(100%-1.5rem,640px)] border border-border bg-cream p-4 shadow-2xl md:p-6">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Çanta, cüzdan veya SKU ara…"
          className="h-12 w-full border-b border-border bg-transparent text-lg text-espresso outline-none placeholder:text-muted"
        />
        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          {loading && <p className="py-6 text-sm text-muted">Aranıyor…</p>}
          {!loading && data && (
            <div className="space-y-6">
              {data.categories.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted">Kategoriler</p>
                  <div className="flex flex-wrap gap-2">
                    {data.categories.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/products?category=${c.slug}`}
                        onClick={() => onOpenChange(false)}
                        className="border border-border px-3 py-1.5 text-sm hover:bg-ivory"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted">Ürünler</p>
                <ul className="divide-y divide-border">
                  {data.products.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/products/${p.slug}`}
                        onClick={() => onOpenChange(false)}
                        className="flex items-center gap-3 py-3 hover:bg-ivory/60"
                      >
                        <div className="relative h-14 w-12 overflow-hidden bg-sand">
                          {p.primaryImage && (
                            <Image src={p.primaryImage} alt="" fill className="object-cover" sizes="48px" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-espresso">{p.name}</p>
                          <p className="text-xs text-muted">{formatPrice(p.price)}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                  {data.products.length === 0 && (
                    <li className="py-6 text-sm text-muted">Sonuç bulunamadı</li>
                  )}
                </ul>
              </div>
              <Link
                href={`/search?q=${encodeURIComponent(q)}`}
                onClick={() => onOpenChange(false)}
                className="inline-block text-sm uppercase tracking-widest text-leather"
              >
                Tüm sonuçları gör
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
