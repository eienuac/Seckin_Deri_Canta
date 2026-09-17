import type { Payload, Where } from 'payload'
import { getPayloadClient } from '@/lib/payload'
import { getInventoryBySkus } from '@/services/inventory/sync'
import type { Category, Media, Product } from '@/payload-types'
import type { ProductCardDTO, ProductDetailDTO, ProductFilters } from '@/types/product'
import { absoluteUrl } from '@/lib/utils'

const LOCALE = 'tr' as const

const queryOpts = {
  locale: LOCALE,
  fallbackLocale: false as const,
  overrideAccess: true,
}

function mediaUrl(media: number | Media | null | undefined): string | null {
  if (!media || typeof media === 'number') return null
  return media.sizes?.card?.url || media.url || null
}

function categoryName(cat: number | Category | null | undefined): string | null {
  if (!cat || typeof cat === 'number') return null
  return cat.name
}

function relationId(value: unknown): string | number | null {
  if (value == null) return null
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return (value as { id: string | number }).id
  }
  if (typeof value === 'string' || typeof value === 'number') return value
  return null
}

function mapCard(product: Product, inStock: boolean): ProductCardDTO {
  const images = product.images ?? []
  const primary = images.find((i) => i.isPrimary) || images[0]
  const secondary = images.find((i) => i !== primary) || images[1]

  return {
    id: String(product.id),
    name: product.name,
    slug: product.slug,
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? null,
    categoryName: categoryName(product.category),
    colors: (product.colors ?? []).map((c) => ({ name: c.name, hex: c.hex })),
    primaryImage: mediaUrl(primary?.image),
    secondaryImage: mediaUrl(secondary?.image),
    isNew: Boolean(product.isNew),
    isBestSeller: Boolean(product.isBestSeller),
    inStock,
    sku: product.sku,
  }
}

async function resolveBySlug(
  payload: Payload,
  collection: 'categories' | 'collections',
  slug: string
): Promise<string | number | null> {
  const result = await payload.find({
    collection,
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    ...queryOpts,
  })
  return result.docs[0]?.id ?? null
}

async function buildWhere(payload: Payload, filters: ProductFilters): Promise<Where> {
  const and: Where[] = [
    { _status: { equals: 'published' } },
    { isActive: { equals: true } },
  ]

  if (filters.category) {
    const id = await resolveBySlug(payload, 'categories', filters.category)
    if (id != null) and.push({ category: { equals: id } })
    else and.push({ id: { equals: '___no_match___' } })
  }

  if (filters.subCategory) {
    const id = await resolveBySlug(payload, 'categories', filters.subCategory)
    if (id != null) and.push({ subCategory: { equals: id } })
    else and.push({ id: { equals: '___no_match___' } })
  }

  if (filters.collection) {
    const id = await resolveBySlug(payload, 'collections', filters.collection)
    if (id != null) and.push({ collection: { equals: id } })
    else and.push({ id: { equals: '___no_match___' } })
  }

  if (filters.gender) {
    and.push({ gender: { equals: filters.gender } })
  }
  if (filters.color) {
    and.push({ 'colors.name': { contains: filters.color } })
  }
  if (filters.leatherType) {
    and.push({ leatherType: { contains: filters.leatherType } })
  }
  if (filters.material) {
    and.push({ material: { contains: filters.material } })
  }
  if (filters.minPrice != null) {
    and.push({ price: { greater_than_equal: filters.minPrice } })
  }
  if (filters.maxPrice != null) {
    and.push({ price: { less_than_equal: filters.maxPrice } })
  }
  if (filters.q) {
    and.push({
      or: [
        { name: { contains: filters.q } },
        { shortDescription: { contains: filters.q } },
        { sku: { contains: filters.q } },
      ],
    })
  }

  return { and }
}

function sortMap(sort: ProductFilters['sort']): string {
  switch (sort) {
    case 'newest':
      return '-createdAt'
    case 'price-asc':
      return 'price'
    case 'price-desc':
      return '-price'
    case 'bestseller':
      return '-isBestSeller'
    default:
      return '-createdAt'
  }
}

async function stockMapForProducts(products: Product[]) {
  const map = new Map<string, number>()
  const skus: string[] = []

  // CMS stock is the editable source of truth for display/availability
  for (const p of products) {
    if (p.variants?.length) {
      for (const v of p.variants) {
        if (!v.sku) continue
        map.set(v.sku, Math.max(0, Number(v.stock ?? 0)))
        skus.push(v.sku)
      }
    } else if (p.sku) {
      map.set(p.sku, Math.max(0, Number(p.stock ?? 0)))
      skus.push(p.sku)
    }
  }

  // Only subtract reserved units from ops DB — never overwrite CMS stock with stale inventory.quantity
  try {
    const inventory = await getInventoryBySkus(skus)
    for (const row of inventory) {
      const cms = map.get(row.sku) ?? 0
      const reserved = row.reserved_quantity ?? 0
      map.set(row.sku, Math.max(0, cms - reserved))
    }
  } catch {
    // CMS-only map already populated
  }

  return map
}

function productInStock(product: Product, stock: Map<string, number>) {
  if (product.variants?.length) {
    return product.variants.some((v) => (stock.get(v.sku) ?? 0) > 0)
  }
  return (stock.get(product.sku) ?? 0) > 0
}

export async function listProducts(filters: ProductFilters) {
  const payload = await getPayloadClient()
  const where = await buildWhere(payload, filters)

  const result = await payload.find({
    collection: 'products',
    where,
    depth: 2,
    limit: filters.limit,
    page: filters.page,
    sort: sortMap(filters.sort),
    draft: false,
    ...queryOpts,
  })

  let docs = result.docs as Product[]
  const stock = await stockMapForProducts(docs)

  if (filters.inStock) {
    docs = docs.filter((p) => productInStock(p, stock))
  }

  return {
    items: docs.map((p) => mapCard(p, productInStock(p, stock))),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    page: result.page ?? filters.page,
    hasNextPage: result.hasNextPage,
    hasPrevPage: result.hasPrevPage,
  }
}

export async function getProductBySlug(slug: string): Promise<ProductDetailDTO | null> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'products',
    where: {
      and: [
        { slug: { equals: slug } },
        { _status: { equals: 'published' } },
        { isActive: { equals: true } },
      ],
    },
    depth: 2,
    limit: 1,
    draft: false,
    ...queryOpts,
  })

  const product = result.docs[0] as Product | undefined
  if (!product) return null

  const stock = await stockMapForProducts([product])
  const card = mapCard(product, productInStock(product, stock))

  const images =
    product.images
      ?.map((img) => {
        const url = mediaUrl(img.image)
        if (!url) return null
        const alt =
          img.alt ||
          (typeof img.image !== 'number' ? img.image.alt : product.name) ||
          product.name
        return { url, alt, isPrimary: Boolean(img.isPrimary) }
      })
      .filter(Boolean) ?? []

  const availableForSku = (sku: string) => Math.max(0, stock.get(sku) ?? 0)

  const variants =
    product.variants && product.variants.length > 0
      ? product.variants.map((v) => {
          const availableQty = availableForSku(v.sku)
          return {
            id: v.id ? String(v.id) : v.sku,
            color: v.color,
            size: v.size,
            sku: v.sku,
            price: v.price ?? product.price,
            availableQty,
            inStock: availableQty > 0,
          }
        })
      : [
          {
            id: 'default',
            color: product.colors?.[0]?.name,
            size: null,
            sku: product.sku,
            price: product.price,
            availableQty: availableForSku(product.sku),
            inStock: availableForSku(product.sku) > 0,
          },
        ]

  let ratingAverage: number | null = null
  let ratingCount = 0
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from('reviews')
      .select('rating')
      .eq('product_id', String(product.id))
      .eq('is_approved', true)
    if (data && data.length > 0) {
      ratingCount = data.length
      ratingAverage = data.reduce((s, r) => s + r.rating, 0) / data.length
    }
  } catch {
    // optional
  }

  const og =
    product.seo?.ogImage && typeof product.seo.ogImage !== 'number'
      ? product.seo.ogImage.url
      : card.primaryImage

  return {
    ...card,
    shortDescription: product.shortDescription ?? null,
    description: product.description,
    brand: product.brand ?? null,
    gender: product.gender ?? null,
    leatherType: product.leatherType ?? null,
    material: product.material ?? null,
    dimensions: product.dimensions ?? null,
    weight: product.weight ?? null,
    careInstructions: product.careInstructions ?? null,
    shippingInfo: product.shippingInfo ?? null,
    returnInfo: product.returnInfo ?? null,
    images: images as ProductDetailDTO['images'],
    variants,
    seo: {
      title: product.seo?.title || product.name,
      description: product.seo?.description || product.shortDescription,
      canonical: product.seo?.canonical || absoluteUrl(`/products/${product.slug}`),
      ogImage: og ?? null,
    },
    ratingAverage,
    ratingCount,
  }
}

export async function getRelatedProducts(productId: string, limit = 4) {
  const payload = await getPayloadClient()
  const current = await payload
    .findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      ...queryOpts,
    })
    .catch(() => null)

  if (!current) return []

  const categoryId = relationId(current.category)
  const and: Where[] = [
    { id: { not_equals: productId } },
    { _status: { equals: 'published' } },
    { isActive: { equals: true } },
  ]
  if (categoryId != null) {
    and.push({ category: { equals: categoryId } })
  }

  const result = await payload.find({
    collection: 'products',
    where: { and },
    depth: 2,
    limit,
    draft: false,
    ...queryOpts,
  })

  const docs = result.docs as Product[]
  const stock = await stockMapForProducts(docs)
  return docs.map((p) => mapCard(p, productInStock(p, stock)))
}

export async function searchSuggestions(q: string) {
  if (!q || q.trim().length < 2) {
    return { products: [] as ProductCardDTO[], categories: [] as Array<{ name: string; slug: string }> }
  }

  const payload = await getPayloadClient()
  const [products, categories] = await Promise.all([
    payload.find({
      collection: 'products',
      where: {
        and: [
          { _status: { equals: 'published' } },
          { isActive: { equals: true } },
          {
            or: [
              { name: { contains: q } },
              { sku: { contains: q } },
              { shortDescription: { contains: q } },
            ],
          },
        ],
      },
      depth: 2,
      limit: 6,
      draft: false,
      ...queryOpts,
    }),
    payload.find({
      collection: 'categories',
      where: {
        or: [{ name: { contains: q } }, { slug: { contains: q } }],
      },
      limit: 4,
      ...queryOpts,
    }),
  ])

  const docs = products.docs as Product[]
  const stock = await stockMapForProducts(docs)

  return {
    products: docs.map((p) => mapCard(p, productInStock(p, stock))),
    categories: (categories.docs as Category[]).map((c) => ({ name: c.name, slug: c.slug })),
  }
}

export async function getFilterFacets() {
  const payload = await getPayloadClient()
  const products = await payload.find({
    collection: 'products',
    where: { and: [{ _status: { equals: 'published' } }, { isActive: { equals: true } }] },
    depth: 1,
    limit: 500,
    draft: false,
    ...queryOpts,
  })

  const docs = products.docs as Product[]
  const colors = new Set<string>()
  const leatherTypes = new Set<string>()
  const materials = new Set<string>()
  let minPrice = Infinity
  let maxPrice = 0

  for (const p of docs) {
    p.colors?.forEach((c) => colors.add(c.name))
    if (p.leatherType) leatherTypes.add(p.leatherType)
    if (p.material) materials.add(p.material)
    minPrice = Math.min(minPrice, p.price)
    maxPrice = Math.max(maxPrice, p.price)
  }

  const [categories, collections] = await Promise.all([
    payload.find({
      collection: 'categories',
      limit: 100,
      sort: 'navOrder',
      ...queryOpts,
    }),
    payload.find({
      collection: 'collections',
      limit: 50,
      ...queryOpts,
    }),
  ])

  return {
    colors: [...colors].sort(),
    leatherTypes: [...leatherTypes].sort(),
    materials: [...materials].sort(),
    priceRange: {
      min: Number.isFinite(minPrice) ? minPrice : 0,
      max: maxPrice || 10000,
    },
    categories: (categories.docs as Category[]).map((c) => ({
      name: c.name,
      slug: c.slug,
      parentId:
        typeof c.parentCategory === 'object' && c.parentCategory
          ? c.parentCategory.id
          : (c.parentCategory as number | null | undefined) ?? null,
    })),
    collections: (collections.docs as unknown as { name: string; slug: string }[]).map((c) => ({
      name: c.name,
      slug: c.slug,
    })),
  }
}

export async function getHomepageContent() {
  const payload = await getPayloadClient()
  return payload.findGlobal({
    slug: 'homepage',
    depth: 2,
    ...queryOpts,
  })
}

export async function getHeaderCategories() {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'categories',
    where: { showInHeader: { equals: true } },
    sort: 'navOrder',
    limit: 50,
    depth: 1,
    ...queryOpts,
  })
  return result.docs as Category[]
}
