import type { Metadata } from 'next'
import { Cormorant_Garamond, Manrope } from 'next/font/google'
import { AuthProvider } from '@/hooks/use-auth'
import { CartProvider } from '@/hooks/use-cart'
import { ToastProvider } from '@/components/ui/toaster'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { getHeaderCategories } from '@/services/products'
import { absoluteUrl } from '@/lib/utils'
import '../globals.css'

const display = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-display',
})

const body = Manrope({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'Seçkin Çanta | Zamansız Deri',
    template: '%s | Seçkin Çanta',
  },
  description: 'Çantalardan cüzdanlara, gerçek deri ve zamansız tasarım.',
  alternates: {
    canonical: absoluteUrl('/'),
  },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    siteName: 'Seçkin Çanta',
    title: 'Seçkin Çanta | Zamansız Deri',
    description: 'Çantalardan cüzdanlara, gerçek deri ve zamansız tasarım.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Seçkin Çanta | Zamansız Deri',
    description: 'Çantalardan cüzdanlara, gerçek deri ve zamansız tasarım.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

type HeaderCategory = {
  name: string
  slug: string
  parentId?: number | null
}

async function safeCategories(): Promise<HeaderCategory[]> {
  try {
    const cats = await getHeaderCategories()
    return (cats ?? []).map((c) => ({
      name: c.name,
      slug: c.slug,
      parentId:
        typeof c.parentCategory === 'object'
          ? c.parentCategory?.id ?? null
          : c.parentCategory ?? null,
    }))
  } catch (error) {
    console.error('[RootLayout] Failed to load header categories:', error)
    return []
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let categories: HeaderCategory[] = []
  try {
    categories = await safeCategories()
  } catch (error) {
    console.error('[RootLayout] Unexpected layout data error:', error)
    categories = []
  }

  return (
    <html lang="tr">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <AuthProvider>
          <CartProvider>
            <SiteHeader categories={categories} />
            <main className="min-h-[70vh]">{children}</main>
            <SiteFooter />
            <ToastProvider />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
