import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/utils'

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl()
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/app-admin', '/api/', '/account', '/checkout'],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  }
}
