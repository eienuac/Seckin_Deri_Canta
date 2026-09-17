import Link from 'next/link'
import Image from 'next/image'
import { listProducts, getHomepageContent } from '@/services/products'
import { ProductCard } from '@/components/product/product-card'
import { Button } from '@/components/ui/button'
import type { Homepage, Product } from '@/payload-types'
import type { ProductCardDTO } from '@/types/product'

export const revalidate = 60

const EMPTY_LIST = {
  items: [] as ProductCardDTO[],
  totalDocs: 0,
  totalPages: 0,
  page: 1,
  hasNextPage: false,
  hasPrevPage: false,
}

async function safeHomepage(): Promise<Homepage | null> {
  try {
    return (await getHomepageContent()) as Homepage
  } catch (error) {
    console.error('[HomePage] Failed to load homepage CMS content:', error)
    return null
  }
}

async function safeList(params: Parameters<typeof listProducts>[0], label: string) {
  try {
    const result = await listProducts(params)
    return {
      ...result,
      items: result.items ?? [],
    }
  } catch (error) {
    console.error(`[HomePage] Failed to load products (${label}):`, error)
    return EMPTY_LIST
  }
}

export default async function HomePage() {
  let homepage: Homepage | null = null
  let featured = EMPTY_LIST
  let newest = EMPTY_LIST
  let men = EMPTY_LIST
  let women = EMPTY_LIST

  try {
    homepage = await safeHomepage()
    ;[featured, newest, men, women] = await Promise.all([
      safeList({ sort: 'recommended', limit: 4, page: 1 }, 'featured'),
      safeList({ sort: 'newest', limit: 4, page: 1 }, 'newest'),
      safeList({ sort: 'recommended', gender: 'men', limit: 4, page: 1 }, 'men'),
      safeList({ sort: 'recommended', gender: 'women', limit: 4, page: 1 }, 'women'),
    ])
  } catch (error) {
    console.error('[HomePage] Unexpected homepage data error:', error)
  }

  let featuredItems = featured.items ?? []
  try {
    if (homepage?.featuredProductIds?.length) {
      const ids = homepage.featuredProductIds
        .map((p) => (typeof p === 'object' ? (p as Product) : null))
        .filter(Boolean) as Product[]
      if (ids.length) {
        featuredItems = ids.slice(0, 4).map((p) => ({
          id: String(p.id),
          name: p.name,
          slug: p.slug,
          price: p.price,
          compareAtPrice: p.compareAtPrice ?? null,
          categoryName: null,
          colors: (p.colors ?? []).map((c) => ({ name: c.name, hex: c.hex })),
          primaryImage: null,
          secondaryImage: null,
          isNew: Boolean(p.isNew),
          isBestSeller: Boolean(p.isBestSeller),
          inStock: true,
          sku: p.sku,
        }))
      }
    }
  } catch (error) {
    console.error('[HomePage] Failed to map featured products:', error)
    featuredItems = featured.items ?? []
  }

  const hero = homepage?.hero
  const title = hero?.title || 'Zamansız Deri.\nGünlük Hayatın İçin Tasarlandı.'
  const subtitle =
    hero?.subtitle || 'Çantalardan cüzdanlara, gerçek deri ve zamansız tasarım.'

  return (
    <div>
      <section className="relative min-h-[88vh] overflow-hidden bg-espresso text-ivory">
        <div className="absolute inset-0">
          {hero?.image && typeof hero.image !== 'number' && hero.image.url ? (
            <Image
              src={hero.image.sizes?.hero?.url || hero.image.url}
              alt=""
              fill
              priority
              className="object-cover opacity-70"
              sizes="100vw"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 70% 40%, #6b4423 0%, transparent 55%), linear-gradient(135deg, #2c1e16 0%, #3d2a20 45%, #1a1410 100%)',
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-espresso/85 via-espresso/55 to-transparent" />
        </div>

        <div className="container-page relative flex min-h-[88vh] flex-col justify-end pb-20 pt-32 md:justify-center md:pb-24">
          <p className="mb-6 text-[11px] uppercase tracking-[0.28em] text-taba">Seçkin Çanta</p>
          <h1 className="max-w-xl whitespace-pre-line font-display text-5xl leading-[1.05] md:text-7xl">
            {title}
          </h1>
          <p className="mt-6 max-w-md text-base text-ivory/80 md:text-lg">{subtitle}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href={hero?.primaryCta?.href || '/products'}>
              <Button className="bg-ivory text-espresso hover:bg-sand">
                {hero?.primaryCta?.label || 'Koleksiyonu Keşfet'}
              </Button>
            </Link>
            <Link href={hero?.secondaryCta?.href || '/products?sort=newest'}>
              <Button variant="secondary" className="border-ivory/40 text-ivory hover:bg-ivory/10">
                {hero?.secondaryCta?.label || 'Yeni Gelenler'}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <ProductSection title="Öne Çıkanlar" href="/products" items={featuredItems} />
      <ProductSection title="Yeni Gelenler" href="/products?sort=newest" items={newest.items} />

      <section className="container-page grid gap-8 py-20 md:grid-cols-2">
        <Link href="/products?gender=men" className="group relative min-h-[420px] overflow-hidden bg-brown-deep">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#6b4423,transparent_50%)] transition duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 flex flex-col justify-end p-8 text-ivory">
            <p className="text-[11px] uppercase tracking-[0.2em] text-taba">Koleksiyon</p>
            <h2 className="mt-2 font-display text-4xl">Erkek</h2>
          </div>
        </Link>
        <Link href="/products?gender=women" className="group relative min-h-[420px] overflow-hidden bg-leather">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,#c4a48455,transparent_55%)] transition duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 flex flex-col justify-end p-8 text-ivory">
            <p className="text-[11px] uppercase tracking-[0.2em] text-sand">Koleksiyon</p>
            <h2 className="mt-2 font-display text-4xl">Kadın</h2>
          </div>
        </Link>
      </section>

      <ProductSection title="Erkek Koleksiyonu" href="/products?gender=men" items={men.items} />
      <ProductSection title="Kadın Koleksiyonu" href="/products?gender=women" items={women.items} />

      <section className="bg-ivory py-24">
        <div className="container-page grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Marka</p>
            <h2 className="mt-3 font-display text-4xl text-espresso md:text-5xl">
              {homepage?.brandStory?.title || 'Gerçek deri. Gerçek işçilik.'}
            </h2>
            <p className="mt-6 max-w-md text-muted leading-relaxed">
              {homepage?.brandStory?.body ||
                'Seçkin Çanta, seçilmiş deri ve zamansız formlarla günlük hayata eşlik eden çanta ve cüzdanlar üretir.'}
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {(homepage?.qualityPoints?.length
              ? homepage.qualityPoints
              : [
                  { title: 'Tam deri', description: 'Seçilmiş, uzun ömürlü malzemeler.' },
                  { title: 'El işçiliği', description: 'Detaylara özen gösteren üretim.' },
                  { title: 'Zamansız form', description: 'Sezonluk trendlerin ötesinde tasarım.' },
                  { title: 'Günlük kullanım', description: 'Güzellik ve fonksiyon bir arada.' },
                ]
            ).map((point) => (
              <div key={point.title} className="border border-border bg-cream p-5">
                <h3 className="font-display text-xl text-espresso">{point.title}</h3>
                <p className="mt-2 text-sm text-muted">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-24 text-center">
        <h2 className="font-display text-3xl text-espresso md:text-4xl">
          {homepage?.newsletter?.title || 'Yeniliklerden ilk siz haberdar olun'}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted">
          {homepage?.newsletter?.subtitle ||
            'Koleksiyonlar ve özel davetler için e-posta listemize katılın.'}
        </p>
      </section>
    </div>
  )
}

function ProductSection({
  title,
  href,
  items,
}: {
  title: string
  href: string
  items: ProductCardDTO[]
}) {
  if (!items?.length) return null
  return (
    <section className="container-page py-20">
      <div className="mb-10 flex items-end justify-between gap-4">
        <h2 className="font-display text-3xl text-espresso md:text-4xl">{title}</h2>
        <Link href={href} className="text-xs uppercase tracking-[0.18em] text-leather">
          Tümünü Gör
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}
