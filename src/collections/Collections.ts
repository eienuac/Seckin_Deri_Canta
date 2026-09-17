import type { CollectionConfig } from 'payload'

export const Collections: CollectionConfig = {
  slug: 'collections',
  admin: {
    useAsTitle: 'name',
    group: 'Katalog',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Koleksiyon adı',
      required: true,
      localized: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Açıklama',
      localized: true,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Görsel',
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
      label: 'Öne çıkan',
      defaultValue: false,
    },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO',
      fields: [
        { name: 'title', type: 'text', label: 'SEO başlığı', localized: true },
        { name: 'description', type: 'textarea', label: 'Meta description', localized: true },
      ],
    },
  ],
}
