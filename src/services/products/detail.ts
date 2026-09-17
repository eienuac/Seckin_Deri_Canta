import { getProductBySlug, getRelatedProducts } from '@/services/products'
import { listApprovedReviews } from '@/services/reviews'

export { getProductBySlug, getRelatedProducts }

export async function listApprovedSafe(productId: string) {
  try {
    return await listApprovedReviews(productId)
  } catch {
    return []
  }
}
