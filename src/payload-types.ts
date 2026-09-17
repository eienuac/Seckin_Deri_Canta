/* Auto-generated stub — run `payload generate:types` when CMS is connected */
export interface Media {
  id: number
  alt: string
  url?: string | null
  sizes?: {
    thumbnail?: { url?: string | null }
    card?: { url?: string | null }
    hero?: { url?: string | null }
    og?: { url?: string | null }
  }
}

export interface Category {
  id: number
  name: string
  slug: string
  description?: string | null
  image?: number | Media | null
  parentCategory?: number | Category | null
  navOrder?: number | null
  showInHeader?: boolean | null
  seo?: {
    title?: string | null
    description?: string | null
    ogImage?: number | Media | null
  }
  createdAt?: string
  updatedAt?: string
}

export interface Collection {
  id: number
  name: string
  slug: string
  description?: string | null
  image?: number | Media | null
  isFeatured?: boolean | null
}

export interface Product {
  id: number
  name: string
  slug: string
  shortDescription?: string | null
  description?: unknown
  price: number
  compareAtPrice?: number | null
  sku: string
  stock?: number | null
  brand?: string | null
  gender?: 'men' | 'women' | 'unisex' | null
  material?: string | null
  leatherType?: string | null
  category: number | Category
  subCategory?: number | Category | null
  collection?: number | Collection | null
  colors?: Array<{ name: string; hex?: string | null; id?: string | null }> | null
  dimensions?: {
    width?: string | null
    height?: string | null
    depth?: string | null
    notes?: string | null
  } | null
  weight?: string | null
  careInstructions?: string | null
  shippingInfo?: string | null
  returnInfo?: string | null
  isActive?: boolean | null
  isFeatured?: boolean | null
  isNew?: boolean | null
  isBestSeller?: boolean | null
  seo?: {
    title?: string | null
    description?: string | null
    canonical?: string | null
    ogImage?: number | Media | null
  }
  images?: Array<{
    image: number | Media
    alt?: string | null
    isPrimary?: boolean | null
    id?: string | null
  }> | null
  variants?: Array<{
    color?: string | null
    size?: string | null
    sku: string
    price?: number | null
    stock?: number | null
    id?: string | null
  }> | null
  _status?: 'draft' | 'published'
  createdAt: string
  updatedAt: string
}

export interface Homepage {
  hero?: {
    title?: string | null
    subtitle?: string | null
    image?: number | Media | null
    primaryCta?: { label?: string | null; href?: string | null }
    secondaryCta?: { label?: string | null; href?: string | null }
  }
  featuredProductIds?: (number | Product)[] | null
  banners?: Array<{
    title?: string | null
    description?: string | null
    image?: number | Media | null
    ctaLabel?: string | null
    ctaLink?: string | null
    isActive?: boolean | null
    startsAt?: string | null
    endsAt?: string | null
  }> | null
  brandStory?: {
    title?: string | null
    body?: string | null
    image?: number | Media | null
  }
  qualityPoints?: Array<{ title: string; description?: string | null }> | null
  newsletter?: { title?: string | null; subtitle?: string | null }
}

export interface SiteSetting {
  brandName?: string | null
  tagline?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  social?: {
    instagram?: string | null
    facebook?: string | null
    pinterest?: string | null
  }
  footerLegalLinks?: Array<{ label: string; href: string }> | null
}

export interface Page {
  id: number
  title: string
  slug: string
  content?: unknown
  seo?: { title?: string | null; description?: string | null }
  _status?: 'draft' | 'published'
}
