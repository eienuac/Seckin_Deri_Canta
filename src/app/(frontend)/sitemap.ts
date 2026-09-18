import type { MetadataRoute } from 'next'
import { getPayloadClient } from '@/lib/payload'
import { absoluteUrl } from '@/lib/utils'

type SitemapDoc = {
  slug: string
  updatedAt?: string
}

function asSitemapDocs(docs: unknown): SitemapDoc[] {
  if (!Array.isArray(docs)) return []
  const out: SitemapDoc[] = []
  for (const raw of docs) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const slug = typeof row.slug === 'string' ? row.slug : null
    if (!slug) continue
    out.push({
      slug,
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
    })
  }
  return out
}

function toRoutes(
  docs: SitemapDoc[],
  href: (slug: string) => string,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number
): MetadataRoute.Sitemap {
  return docs.map((d) => ({
    url: absoluteUrl(href(d.slug)),
    lastModified: d.updatedAt ? new Date(d.updatedAt) : undefined,
    changeFrequency,
    priority,
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/products'), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/search'), changeFrequency: 'weekly', priority: 0.4 },
  ]

  try {
    const payload = await getPayloadClient()
    const [products, categories, pages] = await Promise.all([
      payload.find({
        collection: 'products',
        where: { and: [{ _status: { equals: 'published' } }, { isActive: { equals: true } }] },
        limit: 5000,
        depth: 0,
        select: { slug: true, updatedAt: true },
      }),
      payload.find({
        collection: 'categories',
        limit: 500,
        depth: 0,
        select: { slug: true, updatedAt: true },
      }),
      payload
        .find({
          collection: 'pages',
          where: { _status: { equals: 'published' } },
          limit: 100,
          depth: 0,
          select: { slug: true, updatedAt: true },
        })
        .catch(() => ({ docs: [] as unknown[] })),
    ])

    return [
      ...staticRoutes,
      ...toRoutes(asSitemapDocs(products.docs), (slug) => `/products/${slug}`, 'weekly', 0.8),
      ...toRoutes(
        asSitemapDocs(categories.docs),
        (slug) => `/products?category=${slug}`,
        'weekly',
        0.7
      ),
      ...toRoutes(asSitemapDocs(pages.docs), (slug) => `/pages/${slug}`, 'monthly', 0.5),
    ]
  } catch {
    return staticRoutes
  }
}
