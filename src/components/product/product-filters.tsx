'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { X } from 'lucide-react'

type Facets = {
  colors: string[]
  leatherTypes: string[]
  materials: string[]
  priceRange: { min: number; max: number }
  categories: Array<{ name: string; slug: string; parentId?: number | null }>
  collections: Array<{ name: string; slug: string }>
}

export function ProductFilters({
  facets,
  current,
  mobile = false,
}: {
  facets: Facets
  current: Record<string, string>
  mobile?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState(current)

  const parents = useMemo(
    () => facets.categories.filter((c) => !c.parentId),
    [facets.categories]
  )
  const children = useMemo(
    () => facets.categories.filter((c) => c.parentId),
    [facets.categories]
  )

  function apply(next: Record<string, string>) {
    const params = new URLSearchParams()
    Object.entries(next).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    router.push(`/products?${params.toString()}`)
    setOpen(false)
  }

  function setField(key: string, value: string) {
    setLocal((s) => ({ ...s, [key]: value }))
  }

  const form = (
    <div className="space-y-8">
      <div>
        <Label>Sıralama</Label>
        <select
          className="mt-1 h-11 w-full border border-border bg-ivory px-3 text-sm"
          value={local.sort || 'recommended'}
          onChange={(e) => setField('sort', e.target.value)}
        >
          <option value="recommended">Önerilen</option>
          <option value="newest">En yeni</option>
          <option value="price-asc">Fiyat: düşükten yükseğe</option>
          <option value="price-desc">Fiyat: yüksekten düşüğe</option>
          <option value="bestseller">Çok satanlar</option>
          <option value="rating">En çok değerlendirilenler</option>
        </select>
      </div>

      <div>
        <Label>Kategori</Label>
        <div className="mt-2 space-y-2">
          {parents.map((c) => (
            <label key={c.slug} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="category"
                checked={local.category === c.slug}
                onChange={() => setField('category', c.slug)}
              />
              {c.name}
            </label>
          ))}
          {parents.length === 0 && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={local.category === 'canta'} onChange={() => setField('category', 'canta')} />
                Çanta
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={local.category === 'cuzdan'} onChange={() => setField('category', 'cuzdan')} />
                Cüzdan
              </label>
            </>
          )}
        </div>
      </div>

      <div>
        <Label>Cinsiyet</Label>
        <div className="mt-2 flex gap-2">
          {[
            { v: 'men', l: 'Erkek' },
            { v: 'women', l: 'Kadın' },
            { v: 'unisex', l: 'Unisex' },
          ].map((g) => (
            <button
              key={g.v}
              type="button"
              onClick={() => setField('gender', local.gender === g.v ? '' : g.v)}
              className={`border px-3 py-1.5 text-xs ${local.gender === g.v ? 'border-espresso bg-espresso text-ivory' : 'border-border'}`}
            >
              {g.l}
            </button>
          ))}
        </div>
      </div>

      {children.length > 0 && (
        <div>
          <Label>Alt kategori</Label>
          <select
            className="mt-1 h-11 w-full border border-border bg-ivory px-3 text-sm"
            value={local.subCategory || ''}
            onChange={(e) => setField('subCategory', e.target.value)}
          >
            <option value="">Tümü</option>
            {children.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <Label>Fiyat</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder={`Min ${facets.priceRange.min}`}
            value={local.minPrice || ''}
            onChange={(e) => setField('minPrice', e.target.value)}
          />
          <Input
            type="number"
            placeholder={`Max ${facets.priceRange.max}`}
            value={local.maxPrice || ''}
            onChange={(e) => setField('maxPrice', e.target.value)}
          />
        </div>
      </div>

      {facets.colors.length > 0 && (
        <div>
          <Label>Renk</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {facets.colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setField('color', local.color === c ? '' : c)}
                className={`border px-2 py-1 text-xs ${local.color === c ? 'border-espresso bg-sand' : 'border-border'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {facets.leatherTypes.length > 0 && (
        <div>
          <Label>Deri türü</Label>
          <select
            className="mt-1 h-11 w-full border border-border bg-ivory px-3 text-sm"
            value={local.leatherType || ''}
            onChange={(e) => setField('leatherType', e.target.value)}
          >
            <option value="">Tümü</option>
            {facets.leatherTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}

      {facets.materials.length > 0 && (
        <div>
          <Label>Malzeme</Label>
          <select
            className="mt-1 h-11 w-full border border-border bg-ivory px-3 text-sm"
            value={local.material || ''}
            onChange={(e) => setField('material', e.target.value)}
          >
            <option value="">Tümü</option>
            {facets.materials.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}

      {facets.collections.length > 0 && (
        <div>
          <Label>Koleksiyon</Label>
          <select
            className="mt-1 h-11 w-full border border-border bg-ivory px-3 text-sm"
            value={local.collection || ''}
            onChange={(e) => setField('collection', e.target.value)}
          >
            <option value="">Tümü</option>
            {facets.collections.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={local.inStock === 'true'}
          onChange={(e) => setField('inStock', e.target.checked ? 'true' : '')}
        />
        Sadece stoktakiler
      </label>

      <div className="flex gap-2">
        <Button type="button" className="flex-1" onClick={() => apply(local)}>
          Uygula
        </Button>
        <Button type="button" variant="secondary" onClick={() => apply({})}>
          Temizle
        </Button>
      </div>
    </div>
  )

  if (!mobile) return form

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Filtrele
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-espresso/40" aria-label="Kapat" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto border-t border-border bg-cream p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl">Filtreler</h2>
              <button type="button" aria-label="Kapat" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {form}
          </div>
        </div>
      )}
    </>
  )
}
