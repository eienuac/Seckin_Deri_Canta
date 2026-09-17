import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getErrorMessage } from '@/lib/errors'

type Client = SupabaseClient<Database>

export async function ensureUserProfile(admin: Client, user: User) {
  const { data: existing, error: selectError } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (selectError) throw selectError
  if (existing) return

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const { error } = await admin.from('profiles').insert({
    id: user.id,
    email: user.email ?? null,
    first_name: typeof meta.first_name === 'string' ? meta.first_name : '',
    last_name: typeof meta.last_name === 'string' ? meta.last_name : '',
  })
  if (error) throw error
}

export async function listFavorites(client: Client, userId: string) {
  const { data, error } = await client
    .from('favorites')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    const err = new Error(getErrorMessage(error))
    ;(err as Error & { cause?: unknown }).cause = error
    throw err
  }
  return data ?? []
}

export async function toggleFavorite(client: Client, userId: string, productId: string) {
  const { data: existing, error: findError } = await client
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle()

  if (findError) {
    throw new Error(getErrorMessage(findError))
  }

  if (existing) {
    const { error } = await client.from('favorites').delete().eq('id', existing.id)
    if (error) throw new Error(getErrorMessage(error))
    return { favorited: false }
  }

  const { error } = await client.from('favorites').insert({ user_id: userId, product_id: productId })
  if (error) throw new Error(getErrorMessage(error))
  return { favorited: true }
}

export async function mergeGuestFavorites(client: Client, userId: string, productIds: string[]) {
  const unique = [...new Set(productIds.filter(Boolean))]
  if (unique.length === 0) return

  const rows = unique.map((product_id) => ({ user_id: userId, product_id }))
  const { error } = await client.from('favorites').upsert(rows, {
    onConflict: 'user_id,product_id',
    ignoreDuplicates: true,
  })
  if (error) throw new Error(getErrorMessage(error))
}
