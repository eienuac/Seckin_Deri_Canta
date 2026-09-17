import type { CollectionConfig } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    group: 'Katalog',
    defaultColumns: ['name', 'slug', 'parentCategory', 'updatedAt'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Kategori adı',
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
      admin: {
        position: 'sidebar',
      },
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
      name: 'parentCategory',
      type: 'relationship',
      relationTo: 'categories',
      label: 'Üst kategori',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'navOrder',
      type: 'number',
      label: 'Menü sırası',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'showInHeader',
      type: 'checkbox',
      label: 'Header menüsünde göster',
      defaultValue: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO',
      fields: [
        { name: 'title', type: 'text', label: 'SEO başlığı', localized: true },
        { name: 'description', type: 'textarea', label: 'Meta description', localized: true },
        { name: 'ogImage', type: 'upload', relationTo: 'media', label: 'OG görseli' },
      ],
    },
  ],
}
