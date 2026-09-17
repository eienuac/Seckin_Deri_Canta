import type { Metadata } from 'next'
import { listProducts } from '@/services/products'
import { productFilterSchema } from '@/types/product'
import { ProductCard, EmptyState } from '@/components/product/product-card'

export const metadata: Metadata = {
  title: 'Arama',
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  const filters = productFilterSchema.parse({ q, sort: 'recommended', page: 1, limit: 24 })

  let items: Awaited<ReturnType<typeof listProducts>>['items'] = []
  try {
    const result = await listProducts(filters)
    items = result.items
  } catch {
    items = []
  }

  return (
    <div className="container-page py-10 md:py-14">
      <h1 className="font-display text-4xl text-espresso">Arama</h1>
      <p className="mt-2 text-muted">{q ? `“${q}” için sonuçlar` : 'Bir arama terimi girin'}</p>
      {items.length === 0 ? (
        <EmptyState title="Sonuç yok" description="Farklı bir kelime deneyin." />
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
