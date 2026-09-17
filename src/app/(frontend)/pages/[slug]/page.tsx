import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import type { Page } from '@/payload-types'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'pages',
      where: { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] },
      limit: 1,
    })
    const page = result.docs[0] as Page | undefined
    if (!page) return { title: 'Sayfa' }
    return {
      title: page.seo?.title || page.title,
      description: page.seo?.description || undefined,
    }
  } catch {
    return { title: 'Sayfa' }
  }
}

const FALLBACK: Record<string, { title: string; body: string }> = {
  hakkimizda: {
    title: 'Hakkımızda',
    body: 'Seçkin Çanta, gerçek deri ve zamansız tasarım anlayışıyla çanta ve cüzdan üretir.',
  },
  iletisim: {
    title: 'İletişim',
    body: 'Bize hello@seckincanta.com adresinden ulaşabilirsiniz.',
  },
  kvkk: {
    title: 'KVKK',
    body: 'Kişisel verileriniz 6698 sayılı KVKK kapsamında işlenir. Bu metni CMS üzerinden güncelleyin.',
  },
  'gizlilik-politikasi': {
    title: 'Gizlilik Politikası',
    body: 'Gizlilik politikası metni CMS Pages koleksiyonundan yönetilir.',
  },
  'cerez-politikasi': {
    title: 'Çerez Politikası',
    body: 'Çerez politikası metni CMS Pages koleksiyonundan yönetilir.',
  },
  'kullanim-kosullari': {
    title: 'Kullanım Koşulları',
    body: 'Kullanım koşulları metni CMS Pages koleksiyonundan yönetilir.',
  },
  'mesafeli-satis-sozlesmesi': {
    title: 'Mesafeli Satış Sözleşmesi',
    body: 'Mesafeli satış sözleşmesi metni CMS Pages koleksiyonundan yönetilir.',
  },
  'kargo-ve-teslimat': {
    title: 'Kargo ve Teslimat',
    body: 'Siparişler 2-4 iş günü içinde kargoya verilir. 3000 TL üzeri ücretsiz kargo.',
  },
  'iade-ve-degisim': {
    title: 'İade ve Değişim',
    body: 'Teslimattan sonra 14 gün içinde iade talebi oluşturabilirsiniz.',
  },
  sss: {
    title: 'Sıkça Sorulan Sorular',
    body: 'Sipariş, kargo ve iade hakkında sık sorulan sorular CMS’den yönetilir.',
  },
  magazalar: {
    title: 'Mağazalar',
    body: 'Mağaza adresleri yakında eklenecek.',
  },
}

export default async function CmsPage({ params }: Props) {
  const { slug } = await params

  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'pages',
      where: { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] },
      limit: 1,
    })
    const page = result.docs[0] as Page | undefined
    if (page) {
      return (
        <article className="container-page prose prose-neutral max-w-3xl py-14">
          <h1 className="font-display text-4xl text-espresso">{page.title}</h1>
          <div className="mt-8 whitespace-pre-line text-muted">
            {/* Rich text rendered as fallback text until Lexical serializer is added */}
            İçerik CMS’den yönetilir. Lexical renderer Phase 2 iyileştirmesinde eklenebilir.
          </div>
        </article>
      )
    }
  } catch {
    // fall through to static fallbacks
  }

  const fallback = FALLBACK[slug]
  if (!fallback) notFound()

  return (
    <article className="container-page max-w-3xl py-14">
      <h1 className="font-display text-4xl text-espresso">{fallback.title}</h1>
      <p className="mt-8 text-muted leading-relaxed">{fallback.body}</p>
    </article>
  )
}
