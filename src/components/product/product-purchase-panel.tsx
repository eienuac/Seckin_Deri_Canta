'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import type { ProductDetailDTO } from '@/types/product'
import { AddToCartButton } from '@/components/product/add-to-cart-button'
import { FavoriteButton } from '@/components/product/favorite-button'
import { Button } from '@/components/ui/button'

export function ProductPurchasePanel({ product }: { product: ProductDetailDTO }) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id)
  const [qty, setQty] = useState(1)

  const variant = useMemo(
    () => product.variants.find((v) => v.id === variantId) || product.variants[0],
    [product.variants, variantId]
  )

  const price = variant?.price ?? product.price
  const availableQty = variant?.availableQty ?? 0
  const inStock = Boolean(variant?.inStock ?? product.inStock) && availableQty > 0

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          {product.categoryName && (
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{product.categoryName}</p>
          )}
          <h1 className="mt-2 font-display text-4xl text-espresso md:text-5xl">{product.name}</h1>
        </div>
        <FavoriteButton productId={product.id} />
      </div>

      {product.ratingAverage != null && (
        <p className="mt-3 text-sm text-muted">
          {product.ratingAverage.toFixed(1)} / 5 · {product.ratingCount} değerlendirme
        </p>
      )}

      <div className="mt-6 flex items-baseline gap-3">
        <span className="text-2xl text-espresso">{formatPrice(price)}</span>
        {product.compareAtPrice && product.compareAtPrice > price && (
          <span className="text-muted line-through">{formatPrice(product.compareAtPrice)}</span>
        )}
      </div>

      {product.shortDescription && (
        <p className="mt-6 text-muted leading-relaxed">{product.shortDescription}</p>
      )}

      {product.variants.length > 1 && (
        <div className="mt-8">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Varyant</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={!v.inStock}
                onClick={() => setVariantId(v.id)}
                className={`border px-3 py-2 text-sm ${
                  variantId === v.id ? 'border-espresso bg-espresso text-ivory' : 'border-border'
                } disabled:opacity-40`}
              >
                {[v.color, v.size].filter(Boolean).join(' / ') || v.sku}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Adet</p>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            className="h-10 w-10 border border-border"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <span className="w-8 text-center">{qty}</span>
          <button
            type="button"
            className="h-10 w-10 border border-border"
            onClick={() => setQty((q) => Math.min(Math.max(availableQty, 1), q + 1))}
          >
            +
          </button>
          <span className="text-sm text-muted">
            {inStock ? `${availableQty} adet stokta` : 'Stokta yok'}
          </span>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <AddToCartButton
          productId={product.id}
          sku={variant?.sku || product.sku}
          variantId={variant?.id}
          quantity={qty}
          disabled={!inStock}
          className="flex-1"
        />
        <Link href={`/checkout?buyNow=${product.id}&sku=${variant?.sku || product.sku}&qty=${qty}`} className="flex-1">
          <Button variant="secondary" className="w-full" disabled={!inStock}>
            Hemen Al
          </Button>
        </Link>
      </div>
    </div>
  )
}
