// @ts-nocheck

import type { MetadataRoute } from 'next'
import { getPayloadClient } from '@/lib/payload'
import { absoluteUrl } from '@/lib/utils'

/** Minimal shape for sitemap entries — avoids Payload select/partial vs full Category mismatch */
type SitemapDoc = {
  slug?: string | null
  updatedAt?: string | null
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
        .catch(() => ({ docs: [] as SitemapDoc[] })),
    ])

    const productRoutes = (products.docs as SitemapDoc[])
      .filter((p) => p.slug)
      .map((p) => ({
        url: absoluteUrl(`/products/${p.slug}`),
        lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }))

    const categoryRoutes = (categories.docs as SitemapDoc[])
      .filter((c) => c.slug)
      .map((c) => ({
        url: absoluteUrl(`/products?category=${c.slug}`),
        lastModified: c.updatedAt ? new Date(c.updatedAt) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }))

    const pageRoutes = (pages.docs as SitemapDoc[])
      .filter((p) => p.slug)
      .map((p) => ({
        url: absoluteUrl(`/pages/${p.slug}`),
        lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      }))

    return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...pageRoutes]
  } catch {
    return staticRoutes
  }
}
