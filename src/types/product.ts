import { z } from 'zod'

export const productFilterSchema = z.object({
  category: z.string().optional(),
  gender: z.enum(['men', 'women', 'unisex']).optional(),
  subCategory: z.string().optional(),
  color: z.string().optional(),
  leatherType: z.string().optional(),
  material: z.string().optional(),
  collection: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z.coerce.boolean().optional(),
  sort: z
    .enum(['recommended', 'newest', 'price-asc', 'price-desc', 'bestseller', 'rating'])
    .default('recommended'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  q: z.string().optional(),
})

export type ProductFilters = z.infer<typeof productFilterSchema>

export type MediaLike = {
  url?: string | null
  alt?: string
  sizes?: Record<string, { url?: string | null } | undefined>
}

export type ProductCardDTO = {
  id: string
  name: string
  slug: string
  price: number
  compareAtPrice: number | null
  categoryName: string | null
  colors: Array<{ name: string; hex?: string | null }>
  primaryImage: string | null
  secondaryImage: string | null
  isNew: boolean
  isBestSeller: boolean
  inStock: boolean
  sku: string
}

export type ProductDetailDTO = ProductCardDTO & {
  shortDescription: string | null
  description: unknown
  brand: string | null
  gender: string | null
  leatherType: string | null
  material: string | null
  dimensions: {
    width?: string | null
    height?: string | null
    depth?: string | null
    notes?: string | null
  } | null
  weight: string | null
  careInstructions: string | null
  shippingInfo: string | null
  returnInfo: string | null
  images: Array<{ url: string; alt: string; isPrimary: boolean }>
  variants: Array<{
    id: string
    color?: string | null
    size?: string | null
    sku: string
    price: number
    inStock: boolean
    availableQty: number
  }>
  seo: {
    title?: string | null
    description?: string | null
    canonical?: string | null
    ogImage?: string | null
  }
  ratingAverage: number | null
  ratingCount: number
}
