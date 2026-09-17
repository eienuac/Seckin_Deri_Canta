import type { CollectionConfig } from 'payload'
import { syncProductInventory } from '@/services/inventory/sync'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name',
    group: 'Katalog',
    defaultColumns: ['name', 'sku', 'price', '_status', 'updatedAt'],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 2000,
      },
    },
  },
  access: {
    read: ({ req }) => {
      if (req.user) return true
      return {
        _status: {
          equals: 'published',
        },
      }
    },
  },
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        // Sync SKU + CMS stock → Supabase inventory (cart/checkout SoT for reservations)
        try {
          await syncProductInventory(doc)
        } catch (error) {
          req.payload.logger.error({
            msg: 'Inventory sync failed',
            err: error,
          })
        }
        return doc
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Ürün Bilgileri',
          fields: [
            {
              name: 'name',
              type: 'text',
              label: 'Ürün adı',
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
                description: 'URL: /products/slug-adi',
              },
            },
            {
              name: 'shortDescription',
              type: 'textarea',
              label: 'Kısa açıklama',
              localized: true,
              maxLength: 300,
            },
            {
              name: 'description',
              type: 'richText',
              label: 'Açıklama',
              localized: true,
            },
            {
              name: 'brand',
              type: 'text',
              label: 'Marka',
              defaultValue: 'Seçkin Çanta',
            },
          ],
        },
        {
          label: 'Satış Bilgileri',
          fields: [
            {
              name: 'price',
              type: 'number',
              label: 'Fiyat (TRY)',
              required: true,
              min: 0,
            },
            {
              name: 'compareAtPrice',
              type: 'number',
              label: 'İndirimli öncesi fiyat',
              min: 0,
              admin: {
                description: 'Varsa üstü çizili eski fiyat',
              },
            },
            {
              name: 'sku',
              type: 'text',
              label: 'SKU',
              required: true,
              unique: true,
              index: true,
            },
            {
              name: 'stock',
              type: 'number',
              label: 'Stok miktarı',
              required: true,
              min: 0,
              defaultValue: 0,
              admin: {
                description:
                  'Varyant yoksa bu stok kullanılır. Varyant varsa her varyantın kendi stoğu geçerlidir.',
              },
            },
            {
              name: 'isActive',
              type: 'checkbox',
              label: 'Aktif',
              defaultValue: true,
            },
            {
              name: 'isFeatured',
              type: 'checkbox',
              label: 'Öne çıkan',
              defaultValue: false,
            },
            {
              name: 'isNew',
              type: 'checkbox',
              label: 'Yeni gelen',
              defaultValue: false,
            },
            {
              name: 'isBestSeller',
              type: 'checkbox',
              label: 'Çok satan',
              defaultValue: false,
            },
          ],
        },
        {
          label: 'Katalog',
          fields: [
            {
              name: 'gender',
              type: 'select',
              label: 'Cinsiyet',
              options: [
                { label: 'Erkek', value: 'men' },
                { label: 'Kadın', value: 'women' },
                { label: 'Unisex', value: 'unisex' },
              ],
            },
            {
              name: 'category',
              type: 'relationship',
              relationTo: 'categories',
              label: 'Kategori',
              required: true,
            },
            {
              name: 'subCategory',
              type: 'relationship',
              relationTo: 'categories',
              label: 'Alt kategori',
            },
            {
              name: 'collection',
              type: 'relationship',
              relationTo: 'collections',
              label: 'Koleksiyon',
            },
          ],
        },
        {
          label: 'Ürün Özellikleri',
          fields: [
            {
              name: 'leatherType',
              type: 'text',
              label: 'Deri türü',
            },
            {
              name: 'material',
              type: 'text',
              label: 'Malzeme',
            },
            {
              name: 'colors',
              type: 'array',
              label: 'Renkler',
              fields: [
                { name: 'name', type: 'text', label: 'Renk adı', required: true },
                { name: 'hex', type: 'text', label: 'Hex kodu' },
              ],
            },
            {
              name: 'dimensions',
              type: 'group',
              label: 'Ölçüler',
              fields: [
                { name: 'width', type: 'text', label: 'Genişlik' },
                { name: 'height', type: 'text', label: 'Yükseklik' },
                { name: 'depth', type: 'text', label: 'Derinlik' },
                { name: 'notes', type: 'textarea', label: 'Ölçü notları' },
              ],
            },
            {
              name: 'weight',
              type: 'text',
              label: 'Ağırlık',
            },
            {
              name: 'careInstructions',
              type: 'textarea',
              label: 'Bakım bilgileri',
              localized: true,
            },
            {
              name: 'shippingInfo',
              type: 'textarea',
              label: 'Kargo bilgileri',
              localized: true,
            },
            {
              name: 'returnInfo',
              type: 'textarea',
              label: 'İade bilgileri',
              localized: true,
            },
          ],
        },
        {
          label: 'Görseller',
          fields: [
            {
              name: 'images',
              type: 'array',
              label: 'Ürün fotoğrafları',
              minRows: 1,
              labels: {
                singular: 'Fotoğraf',
                plural: 'Fotoğraflar',
              },
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  required: true,
                  label: 'Fotoğraf',
                },
                {
                  name: 'alt',
                  type: 'text',
                  label: 'Alt text',
                },
                {
                  name: 'isPrimary',
                  type: 'checkbox',
                  label: 'Ana fotoğraf',
                  defaultValue: false,
                },
              ],
              admin: {
                description: 'Sürükle-bırak ile sıralayın. Ana fotoğrafı işaretleyin.',
              },
            },
          ],
        },
        {
          label: 'Varyantlar',
          fields: [
            {
              name: 'variants',
              type: 'array',
              label: 'Ürün varyantları',
              labels: {
                singular: 'Varyant',
                plural: 'Varyantlar',
              },
              fields: [
                { name: 'color', type: 'text', label: 'Renk' },
                { name: 'size', type: 'text', label: 'Boyut' },
                {
                  name: 'sku',
                  type: 'text',
                  label: 'Varyant SKU',
                  required: true,
                },
                {
                  name: 'price',
                  type: 'number',
                  label: 'Fiyat (boşsa ürün fiyatı)',
                  min: 0,
                },
                {
                  name: 'stock',
                  type: 'number',
                  label: 'Stok miktarı',
                  required: true,
                  min: 0,
                  defaultValue: 0,
                  admin: {
                    description: 'Bu renk/beden için satılabilir stok',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            {
              name: 'seo',
              type: 'group',
              label: 'SEO',
              fields: [
                { name: 'title', type: 'text', label: 'SEO başlığı', localized: true },
                { name: 'description', type: 'textarea', label: 'Meta description', localized: true },
                { name: 'canonical', type: 'text', label: 'Canonical URL' },
                { name: 'ogImage', type: 'upload', relationTo: 'media', label: 'OG image' },
              ],
            },
          ],
        },
      ],
    },
  ],
}
