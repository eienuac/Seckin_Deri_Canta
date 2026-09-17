import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getProductBySlug, getRelatedProducts, listApprovedSafe } from '@/services/products/detail'
import { ProductGallery } from '@/components/product/product-gallery'
import { ProductPurchasePanel } from '@/components/product/product-purchase-panel'
import { ProductCard } from '@/components/product/product-card'
import { absoluteUrl } from '@/lib/utils'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  try {
    const product = await getProductBySlug(slug)
    if (!product) return { title: 'Ürün bulunamadı' }
    return {
      title: product.seo.title || product.name,
      description: product.seo.description || product.shortDescription || undefined,
      alternates: { canonical: product.seo.canonical || absoluteUrl(`/products/${product.slug}`) },
      openGraph: {
        title: product.seo.title || product.name,
        description: product.seo.description || undefined,
        images: product.seo.ogImage ? [{ url: product.seo.ogImage }] : undefined,
      },
    }
  } catch {
    return { title: 'Ürün' }
  }
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params
  const product = await getProductBySlug(slug).catch(() => null)
  if (!product) notFound()

  const [related, reviews] = await Promise.all([
    getRelatedProducts(product.id).catch(() => []),
    listApprovedSafe(product.id),
  ])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription,
    sku: product.sku,
    brand: { '@type': 'Brand', name: product.brand || 'Seçkin Çanta' },
    image: product.images.map((i) => i.url),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'TRY',
      price: product.price,
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: absoluteUrl(`/products/${product.slug}`),
    },
    ...(product.ratingAverage
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.ratingAverage,
            reviewCount: product.ratingCount,
          },
        }
      : {}),
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Ürünler', item: absoluteUrl('/products') },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.name,
        item: absoluteUrl(`/products/${product.slug}`),
      },
    ],
  }

  return (
    <div className="container-page py-10 md:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <ProductGallery images={product.images} name={product.name} />
        <ProductPurchasePanel product={product} />
      </div>

      <section className="mt-16 grid gap-10 border-t border-border pt-12 md:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl text-espresso">Açıklama</h2>
          <p className="mt-4 whitespace-pre-line text-muted leading-relaxed">
            {product.shortDescription || 'Ürün açıklaması yakında eklenecek.'}
          </p>
        </div>
        <div className="space-y-4 text-sm">
          {product.leatherType && <Row label="Deri türü" value={product.leatherType} />}
          {product.material && <Row label="Malzeme" value={product.material} />}
          {product.weight && <Row label="Ağırlık" value={product.weight} />}
          {product.dimensions && (
            <Row
              label="Ölçüler"
              value={[product.dimensions.width, product.dimensions.height, product.dimensions.depth]
                .filter(Boolean)
                .join(' × ')}
            />
          )}
          {product.careInstructions && <Row label="Bakım" value={product.careInstructions} />}
          {product.shippingInfo && <Row label="Kargo" value={product.shippingInfo} />}
          {product.returnInfo && <Row label="İade" value={product.returnInfo} />}
        </div>
      </section>

      <section className="mt-16 border-t border-border pt-12">
        <h2 className="font-display text-2xl text-espresso">Yorumlar</h2>
        {reviews.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Henüz onaylı yorum yok.</p>
        ) : (
          <ul className="mt-6 space-y-6">
            {reviews.map((r) => (
              <li key={r.id} className="border-b border-border pb-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{r.rating}/5</span>
                  {r.title && <span className="text-sm text-espresso">{r.title}</span>}
                  {r.verified_purchase && (
                    <span className="text-[10px] uppercase tracking-widest text-muted">Doğrulanmış alışveriş</span>
                  )}
                </div>
                {r.comment && <p className="mt-2 text-sm text-muted">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {related.length > 0 && (
        <section className="mt-16 border-t border-border pt-12">
          <h2 className="font-display text-2xl text-espresso">Benzer ürünler</h2>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 text-espresso">{value}</p>
    </div>
  )
}
