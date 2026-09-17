'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { useCart } from '@/hooks/use-cart'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/product/product-card'

export default function CartPage() {
  const {
    items,
    subtotal,
    discount,
    couponCode,
    loading,
    updateQuantity,
    removeItem,
    applyCoupon,
    itemCount,
    checkoutBlocked,
    hasStockIssues,
    refresh,
  } = useCart()
  const [coupon, setCoupon] = useState('')

  if (loading) {
    return (
      <div className="container-page py-16">
        <div className="skeleton h-8 w-40" />
        <div className="mt-8 space-y-4">
          <div className="skeleton h-28 w-full" />
          <div className="skeleton h-28 w-full" />
        </div>
      </div>
    )
  }

  if (!itemCount) {
    return (
      <EmptyState
        title="Sepetiniz boş"
        description="Koleksiyondan bir parça seçerek başlayın."
        action={
          <Link href="/products">
            <Button>Alışverişe Devam Et</Button>
          </Link>
        }
      />
    )
  }

  const shippingEstimate = subtotal - discount >= 3000 ? 0 : 79.9
  const total = Math.max(0, subtotal - discount + shippingEstimate)

  return (
    <div className="container-page py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl text-espresso">Sepet</h1>
        <button
          type="button"
          className="text-xs uppercase tracking-widest text-leather"
          onClick={() => refresh().catch(() => null)}
        >
          Stokları yenile
        </button>
      </div>

      {hasStockIssues && (
        <div className="mt-6 border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Sepetinizde stokta olmayan veya stoğu yetersiz ürünler var. Ödemeye geçmeden önce bunları
          güncelleyin veya kaldırın.
        </div>
      )}

      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_340px]">
        <ul className="divide-y divide-border border-y border-border">
          {items.map((row) => {
            const outOfStock = row.stockStatus === 'out_of_stock'
            const insufficient = row.stockStatus === 'insufficient'
            return (
              <li key={row.id} className="flex gap-4 py-6">
                <div className="relative h-28 w-24 shrink-0 bg-sand">
                  {row.imageUrl && (
                    <Image src={row.imageUrl} alt="" fill className="object-cover" sizes="96px" />
                  )}
                  {outOfStock && (
                    <span className="absolute inset-x-0 bottom-0 bg-espresso/90 px-1 py-1 text-center text-[10px] uppercase tracking-widest text-ivory">
                      Stokta Yok
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col">
                  <Link href={`/products/${row.slug}`} className="font-display text-xl text-espresso">
                    {row.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {[row.variant?.color, row.variant?.size, row.variant?.sku].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-2 text-sm">{formatPrice(row.unitPrice)}</p>

                  {outOfStock && (
                    <p className="mt-2 text-sm font-medium text-danger">Stokta Yok</p>
                  )}
                  {insufficient && (
                    <p className="mt-2 text-sm font-medium text-danger">
                      Yetersiz stok (kalan: {row.available})
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-8 w-8 border border-border disabled:opacity-40"
                        disabled={outOfStock}
                        onClick={() =>
                          updateQuantity(row.id, row.quantity - 1).catch((e) => toast.error(e.message))
                        }
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm">{row.quantity}</span>
                      <button
                        type="button"
                        className="h-8 w-8 border border-border disabled:opacity-40"
                        disabled={outOfStock || row.quantity >= row.available}
                        onClick={() =>
                          updateQuantity(row.id, row.quantity + 1).catch((e) => toast.error(e.message))
                        }
                      >
                        +
                      </button>
                      <span className="text-xs text-muted">
                        {outOfStock ? 'Stok: 0' : `Stok: ${row.available}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="text-xs uppercase tracking-widest text-muted hover:text-danger"
                      onClick={() => removeItem(row.id).catch((e) => toast.error(e.message))}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <aside className="h-fit border border-border bg-ivory p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-2xl">Özet</h2>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Ara toplam</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">İndirim{couponCode ? ` (${couponCode})` : ''}</dt>
              <dd>−{formatPrice(discount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Kargo</dt>
              <dd>{shippingEstimate === 0 ? 'Ücretsiz' : formatPrice(shippingEstimate)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-base">
              <dt>Toplam</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>

          <div className="mt-6 flex gap-2">
            <Input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder="Kupon kodu"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                try {
                  await applyCoupon(coupon)
                  toast.success('Kupon uygulandı')
                  setCoupon('')
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Kupon geçersiz')
                }
              }}
            >
              Uygula
            </Button>
          </div>

          <div className="mt-6 space-y-3">
            {checkoutBlocked ? (
              <Button className="w-full" disabled>
                Ödeme Yapılamaz
              </Button>
            ) : (
              <Link href="/checkout">
                <Button className="w-full">Ödeme Yap</Button>
              </Link>
            )}
            <Link href="/products">
              <Button variant="secondary" className="w-full">
                Alışverişe Devam Et
              </Button>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
