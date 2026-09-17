import type { Metadata } from 'next'
import { listProducts, getFilterFacets } from '@/services/products'
import { productFilterSchema } from '@/types/product'
import { ProductCard } from '@/components/product/product-card'
import { ProductFilters } from '@/components/product/product-filters'
import { EmptyState } from '@/components/product/product-card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Ürünler',
  description: 'Seçkin Çanta deri çanta ve cüzdan koleksiyonu.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams
  const flat: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') flat[k] = v
    else if (Array.isArray(v) && v[0]) flat[k] = v[0]
  }

  const parsed = productFilterSchema.safeParse(flat)
  const filters = parsed.success ? parsed.data : productFilterSchema.parse({})

  let result = {
    items: [] as Awaited<ReturnType<typeof listProducts>>['items'],
    totalDocs: 0,
    totalPages: 0,
    page: 1,
    hasNextPage: false,
    hasPrevPage: false,
  }
  let facets = {
    colors: [] as string[],
    leatherTypes: [] as string[],
    materials: [] as string[],
    priceRange: { min: 0, max: 10000 },
    categories: [] as Array<{ name: string; slug: string; parentId?: number | null }>,
    collections: [] as Array<{ name: string; slug: string }>,
  }

  try {
    ;[result, facets] = await Promise.all([listProducts(filters), getFilterFacets()])
  } catch (error) {
    console.error('[ProductsPage] Failed to load catalog/facets:', error)
  }

  const activeChips = Object.entries(flat).filter(([k, v]) => v && k !== 'page' && k !== 'sort')

  return (
    <div className="container-page py-10 md:py-14">
      <div className="mb-10 max-w-2xl">
        <h1 className="font-display text-4xl text-espresso md:text-5xl">Koleksiyon</h1>
        <p className="mt-3 text-muted">Gerçek deri çanta ve cüzdanlar.</p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <ProductFilters facets={facets} current={flat} />
        </aside>

        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <div className="lg:hidden">
                <ProductFilters facets={facets} current={flat} mobile />
              </div>
              {activeChips.map(([k, v]) => (
                <span key={k} className="border border-border bg-ivory px-3 py-1 text-xs text-espresso">
                  {k}: {v}
                </span>
              ))}
              {activeChips.length > 0 && (
                <Link href="/products" className="px-2 py-1 text-xs uppercase tracking-widest text-leather">
                  Filtreleri Temizle
                </Link>
              )}
            </div>
            <p className="text-sm text-muted">{result.totalDocs} ürün</p>
          </div>

          {result.items.length === 0 ? (
            <EmptyState
              title="Ürün bulunamadı"
              description="Filtreleri değiştirmeyi deneyin veya CMS’den ürün yayınlayın."
              action={
                <Link href="/products">
                  <Button variant="secondary">Filtreleri temizle</Button>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6">
              {result.items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {result.totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-3">
              {result.hasPrevPage && (
                <Link
                  href={`/products?${new URLSearchParams({ ...flat, page: String(result.page - 1) }).toString()}`}
                  className="border border-border px-4 py-2 text-sm"
                >
                  Önceki
                </Link>
              )}
              <span className="text-sm text-muted">
                {result.page} / {result.totalPages}
              </span>
              {result.hasNextPage && (
                <Link
                  href={`/products?${new URLSearchParams({ ...flat, page: String(result.page + 1) }).toString()}`}
                  className="border border-border px-4 py-2 text-sm"
                >
                  Sonraki
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
