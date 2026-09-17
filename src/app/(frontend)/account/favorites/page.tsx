'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { useGuestFavorites } from '@/hooks/use-guest-favorites'
import { ProductCard } from '@/components/product/product-card'
import type { ProductCardDTO } from '@/types/product'

export default function FavoritesPage() {
  const { user } = useAuth()
  const guest = useGuestFavorites()
  const [ids, setIds] = useState<string[]>([])
  const [items, setItems] = useState<ProductCardDTO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setIds(guest.ids)
      return
    }
    fetch('/api/favorites')
      .then((r) => r.json())
      .then((d) => setIds((d.favorites || []).map((f: { product_id: string }) => f.product_id)))
      .catch(() => setIds([]))
  }, [user, guest.ids])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      if (ids.length === 0) {
        if (!cancelled) {
          setItems([])
          setLoading(false)
        }
        return
      }
      try {
        const results = await Promise.all(
          ids.map(async (id) => {
            const res = await fetch(`/api/products/${id}?depth=2&locale=tr`)
            if (!res.ok) return null
            return res.json()
          })
        )
        if (cancelled) return
        const cards: ProductCardDTO[] = []
        for (const doc of results) {
          if (!doc || doc.errors) continue
          const images = doc.images ?? []
          const primary = images.find((i: { isPrimary?: boolean }) => i.isPrimary) || images[0]
          const img =
            primary?.image && typeof primary.image === 'object'
              ? primary.image.sizes?.card?.url || primary.image.url
              : null
          cards.push({
            id: String(doc.id),
            name: doc.name,
            slug: doc.slug,
            price: doc.price,
            compareAtPrice: doc.compareAtPrice ?? null,
            categoryName:
              doc.category && typeof doc.category === 'object' ? doc.category.name : null,
            colors: (doc.colors ?? []).map((c: { name: string; hex?: string }) => ({
              name: c.name,
              hex: c.hex,
            })),
            primaryImage: img,
            secondaryImage: null,
            isNew: Boolean(doc.isNew),
            isBestSeller: Boolean(doc.isBestSeller),
            inStock: true,
            sku: doc.sku,
          })
        }
        setItems(cards)
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [ids])

  return (
    <div>
      {!user && <p className="mb-6 text-sm text-muted">Misafir favorileriniz bu cihazda saklanır. Giriş yapınca hesabınıza taşınır.</p>}
      {user && <h2 className="font-display text-3xl text-espresso">Favoriler</h2>}
      {loading ? (
        <p className="mt-6 text-muted">Yükleniyor…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-muted">
          Favori ürününüz yok.{' '}
          <Link href="/products" className="text-espresso underline">
            Koleksiyona göz atın
          </Link>
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
