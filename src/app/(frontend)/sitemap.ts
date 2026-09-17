import type { MetadataRoute } from 'next'
import { getPayloadClient } from '@/lib/payload'
import { absoluteUrl } from '@/lib/utils'
import type { Category, Product } from '@/payload-types'

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
      payload.find({
        collection: 'pages',
        where: { _status: { equals: 'published' } },
        limit: 100,
        depth: 0,
        select: { slug: true, updatedAt: true },
      }).catch(() => ({ docs: [] as Array<{ slug: string; updatedAt: string }> })),
    ])

    const productRoutes = (products.docs as Product[]).map((p) => ({
      url: absoluteUrl(`/products/${p.slug}`),
      lastModified: new Date(p.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

    const categoryRoutes = (categories.docs as Category[]).map((c) => ({
      url: absoluteUrl(`/products?category=${c.slug}`),
      lastModified: new Date(c.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    const pageRoutes = (pages.docs as Array<{ slug: string; updatedAt: string }>).map((p) => ({
      url: absoluteUrl(`/pages/${p.slug}`),
      lastModified: new Date(p.updatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    }))

    return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...pageRoutes]
  } catch {
    return staticRoutes
  }
}
