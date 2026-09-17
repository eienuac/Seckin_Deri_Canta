import Image from 'next/image'
import Link from 'next/link'
import { Heart, ShoppingBag } from 'lucide-react'
import { formatPrice, cn } from '@/lib/utils'
import type { ProductCardDTO } from '@/types/product'
import { FavoriteButton } from '@/components/product/favorite-button'
import { AddToCartButton } from '@/components/product/add-to-cart-button'

export function ProductCard({ product }: { product: ProductCardDTO }) {
  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden bg-sand">
        <Link href={`/products/${product.slug}`} className="block h-full w-full">
          {product.primaryImage ? (
            <>
              <Image
                src={product.primaryImage}
                alt={product.name}
                fill
                sizes="(max-width:768px) 50vw, 25vw"
                className={cn(
                  'object-cover transition-opacity duration-500',
                  product.secondaryImage && 'group-hover:opacity-0'
                )}
              />
              {product.secondaryImage && (
                <Image
                  src={product.secondaryImage}
                  alt=""
                  fill
                  sizes="(max-width:768px) 50vw, 25vw"
                  className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">Görsel yok</div>
          )}
        </Link>
        <div className="absolute right-3 top-3 z-10">
          <FavoriteButton productId={product.id} />
        </div>
        {!product.inStock && (
          <span className="absolute bottom-3 left-3 bg-espresso/90 px-2 py-1 text-[10px] uppercase tracking-widest text-ivory">
            Tükendi
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-1">
        {product.categoryName && (
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{product.categoryName}</p>
        )}
        <Link href={`/products/${product.slug}`} className="font-display text-lg text-espresso">
          {product.name}
        </Link>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-sm text-espresso">{formatPrice(product.price)}</span>
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="text-sm text-muted line-through">{formatPrice(product.compareAtPrice)}</span>
          )}
        </div>
        {product.colors.length > 0 && (
          <div className="mt-2 flex gap-1.5">
            {product.colors.slice(0, 5).map((c) => (
              <span
                key={c.name}
                title={c.name}
                className="h-3 w-3 rounded-full border border-border"
                style={{ background: c.hex || '#8b6914' }}
              />
            ))}
          </div>
        )}
        <div className="mt-auto pt-3">
          <AddToCartButton
            productId={product.id}
            sku={product.sku}
            disabled={!product.inStock}
            size="sm"
            className="w-full"
          />
        </div>
      </div>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="skeleton aspect-[4/5]" />
      <div className="mt-4 space-y-2">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-4 w-24" />
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <ShoppingBag className="mb-4 h-8 w-8 text-muted" strokeWidth={1.25} />
      <h2 className="font-display text-2xl text-espresso">{title}</h2>
      {description && <p className="mt-2 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function HeartEmpty() {
  return <Heart className="h-8 w-8 text-muted" strokeWidth={1.25} />
}
