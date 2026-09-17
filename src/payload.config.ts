import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Categories } from './collections/Categories'
import { Collections } from './collections/Collections'
import { Products } from './collections/Products'
import { Pages } from './collections/Pages'
import { Homepage } from './globals/Homepage'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

function getPostgresPoolConfig() {
  const connectionString = process.env.DATABASE_URL?.trim() || ''

  // Do not throw at module import time — that crashes RootLayout before any try/catch.
  // Connection failures are handled by getPayloadClient() callers with fallbacks.
  if (!connectionString) {
    return {
      connectionString: '',
    }
  }

  let hostname = ''
  try {
    hostname = new URL(connectionString).hostname
  } catch {
    console.error('[payload.config] DATABASE_URL is not a valid PostgreSQL URI')
    return { connectionString: '' }
  }

  if (hostname === '127.0.0.1' || hostname === 'localhost') {
    console.error(
      '[payload.config] DATABASE_URL points to localhost. Use Supabase Postgres URI instead.'
    )
    return { connectionString: '' }
  }

  // Supabase requires TLS. Keep sslmode out of the URL so pool.ssl is respected by node-postgres.
  const isSupabase =
    hostname.includes('supabase.co') || hostname.includes('pooler.supabase.com')

  return {
    connectionString,
    ...(isSupabase
      ? {
          ssl: {
            rejectUnauthorized: false,
          },
        }
      : {}),
  }
}

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: ' — Seçkin Çanta CMS',
    },
    importMap: {
      baseDir: path.resolve(dirname),
      importMapFile: path.resolve(dirname, 'app/(payload)/admin/importMap.js'),
    },
    components: {
      afterNavLinks: ['@/components/admin/AdminAppLink#AdminAppLink'],
    },
  },
  collections: [Users, Media, Categories, Collections, Products, Pages],
  globals: [Homepage, SiteSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    // Keep Payload tables out of public so Supabase Auth / ecommerce tables are untouched
    schemaName: 'payload',
    pool: getPostgresPoolConfig(),
    // Avoid interactive drizzle prompts in local/dev; apply schema via scripts when needed
    push: false,
  }),
  sharp,
  localization: {
    locales: [
      { label: 'Türkçe', code: 'tr' },
      { label: 'English', code: 'en' },
    ],
    defaultLocale: 'tr',
    fallback: true,
  },
})
