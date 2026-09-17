import type { GlobalConfig } from 'payload'

export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Ana Sayfa',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'hero',
      type: 'group',
      label: 'Hero',
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Başlık',
          localized: true,
          defaultValue: 'Zamansız Deri.\nGünlük Hayatın İçin Tasarlandı.',
        },
        {
          name: 'subtitle',
          type: 'textarea',
          label: 'Alt metin',
          localized: true,
          defaultValue: 'Çantalardan cüzdanlara, gerçek deri ve zamansız tasarım.',
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          label: 'Hero görseli',
        },
        {
          name: 'primaryCta',
          type: 'group',
          label: 'Birincil CTA',
          fields: [
            { name: 'label', type: 'text', label: 'Metin', defaultValue: 'Koleksiyonu Keşfet' },
            { name: 'href', type: 'text', label: 'Link', defaultValue: '/products' },
          ],
        },
        {
          name: 'secondaryCta',
          type: 'group',
          label: 'İkincil CTA',
          fields: [
            { name: 'label', type: 'text', label: 'Metin', defaultValue: 'Yeni Gelenler' },
            { name: 'href', type: 'text', label: 'Link', defaultValue: '/products?sort=newest' },
          ],
        },
      ],
    },
    {
      name: 'featuredProductIds',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      label: 'Öne çıkan ürünler',
    },
    {
      name: 'banners',
      type: 'array',
      label: 'Promosyon bannerları',
      fields: [
        { name: 'title', type: 'text', label: 'Başlık', localized: true },
        { name: 'description', type: 'textarea', label: 'Açıklama', localized: true },
        { name: 'image', type: 'upload', relationTo: 'media', label: 'Görsel' },
        { name: 'ctaLabel', type: 'text', label: 'CTA metni' },
        { name: 'ctaLink', type: 'text', label: 'CTA link' },
        { name: 'isActive', type: 'checkbox', label: 'Aktif', defaultValue: true },
        { name: 'startsAt', type: 'date', label: 'Başlangıç' },
        { name: 'endsAt', type: 'date', label: 'Bitiş' },
      ],
    },
    {
      name: 'brandStory',
      type: 'group',
      label: 'Marka hikayesi',
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Başlık',
          localized: true,
          defaultValue: 'Gerçek deri. Gerçek işçilik.',
        },
        {
          name: 'body',
          type: 'textarea',
          label: 'Metin',
          localized: true,
          defaultValue:
            'Seçkin Çanta, seçilmiş deri ve zamansız formlarla günlük hayata eşlik eden çanta ve cüzdanlar üretir.',
        },
        { name: 'image', type: 'upload', relationTo: 'media', label: 'Görsel' },
      ],
    },
    {
      name: 'qualityPoints',
      type: 'array',
      label: 'Kalite noktaları',
      maxRows: 4,
      fields: [
        { name: 'title', type: 'text', label: 'Başlık', required: true, localized: true },
        { name: 'description', type: 'textarea', label: 'Açıklama', localized: true },
      ],
    },
    {
      name: 'newsletter',
      type: 'group',
      label: 'Newsletter',
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Başlık',
          defaultValue: 'Yeniliklerden ilk siz haberdar olun',
        },
        {
          name: 'subtitle',
          type: 'text',
          label: 'Alt metin',
          defaultValue: 'Koleksiyonlar ve özel davetler için e-posta listemize katılın.',
        },
      ],
    },
  ],
}
