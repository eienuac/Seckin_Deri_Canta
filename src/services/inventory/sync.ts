import type { Product } from '@/payload-types'

type SyncableVariant = {
  id?: string | null
  sku?: string | null
  color?: string | null
  size?: string | null
  stock?: number | null
}

type SyncableProduct = {
  id: string | number
  sku?: string | null
  stock?: number | null
  _status?: string | null
  isActive?: boolean | null
  variants?: SyncableVariant[] | null
}

function normalizeStock(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

/**
 * Syncs inventory identity + quantity from Payload CMS stock fields to Supabase.
 * Does NOT copy price, description, or marketing fields.
 * Preserves reserved_quantity on update.
 */
export async function syncProductInventory(doc: SyncableProduct | Product): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return
  }

  const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
  const supabase = getSupabaseAdmin()
  const productId = String(doc.id)

  const rows: Array<{
    sku: string
    product_id: string
    variant_id: string | null
    quantity: number
  }> = []

  if (doc.variants && doc.variants.length > 0) {
    for (const variant of doc.variants) {
      if (!variant?.sku) continue
      rows.push({
        sku: variant.sku,
        product_id: productId,
        variant_id: variant.id ? String(variant.id) : variant.sku,
        quantity: normalizeStock(variant.stock),
      })
    }
  } else if (doc.sku) {
    rows.push({
      sku: doc.sku,
      product_id: productId,
      variant_id: null,
      quantity: normalizeStock(doc.stock),
    })
  }

  if (rows.length === 0) return

  for (const row of rows) {
    const { data: existing } = await supabase
      .from('inventory')
      .select('id, reserved_quantity')
      .eq('sku', row.sku)
      .maybeSingle()

    if (existing) {
      // Never set quantity below already-reserved units
      const reserved = existing.reserved_quantity ?? 0
      const quantity = Math.max(row.quantity, reserved)
      const { error } = await supabase
        .from('inventory')
        .update({
          product_id: row.product_id,
          variant_id: row.variant_id,
          quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('sku', row.sku)
      if (error) throw error
    } else {
      const { error } = await supabase.from('inventory').insert({
        sku: row.sku,
        product_id: row.product_id,
        variant_id: row.variant_id,
        quantity: row.quantity,
        reserved_quantity: 0,
      })
      if (error) throw error
    }
  }
}

export async function getInventoryBySkus(skus: string[]) {
  if (skus.length === 0) return []
  const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('inventory').select('*').in('sku', skus)
  if (error) throw error
  return data ?? []
}

/** Read stock from Payload CMS by product/variant SKU (fallback when inventory row missing). */
export async function getCmsStockBySku(sku: string): Promise<number> {
  try {
    const { getPayloadClient } = await import('@/lib/payload')
    const payload = await getPayloadClient()

    const byVariant = await payload.find({
      collection: 'products',
      where: { 'variants.sku': { equals: sku } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      locale: 'tr',
    })
    const variantProduct = byVariant.docs[0] as Product | undefined
    if (variantProduct?.variants?.length) {
      const match = variantProduct.variants.find((v) => v.sku === sku)
      if (match) return normalizeStock(match.stock)
    }

    const bySku = await payload.find({
      collection: 'products',
      where: { sku: { equals: sku } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      locale: 'tr',
    })
    const product = bySku.docs[0] as Product | undefined
    if (product) return normalizeStock(product.stock)
  } catch {
    // ignore — treat as zero
  }
  return 0
}

export async function getAvailableStock(sku: string): Promise<number> {
  const cmsStock = await getCmsStockBySku(sku)

  try {
    const rows = await getInventoryBySkus([sku])
    const row = rows[0]
    if (row) {
      // Prefer CMS stock as base; only reserved_quantity comes from ops inventory
      return Math.max(0, cmsStock - (row.reserved_quantity ?? 0))
    }
  } catch {
    // ignore inventory read failures
  }

  return cmsStock
}

export async function reserveStock(sku: string, qty: number, idempotencyKey: string): Promise<boolean> {
  const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('reserve_inventory', {
    p_sku: sku,
    p_qty: qty,
    p_idempotency_key: idempotencyKey,
  })
  if (!error) return Boolean(data)

  // Fallback when RPC missing from schema cache
  const { data: existing } = await supabase
    .from('inventory_ledger')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing) return true

  const { data: row } = await supabase
    .from('inventory')
    .select('id, quantity, reserved_quantity')
    .eq('sku', sku)
    .maybeSingle()
  if (!row) return false

  const available = (row.quantity ?? 0) - (row.reserved_quantity ?? 0)
  if (available < qty) return false

  const { error: updErr } = await supabase
    .from('inventory')
    .update({
      reserved_quantity: (row.reserved_quantity ?? 0) + qty,
      updated_at: new Date().toISOString(),
    })
    .eq('sku', sku)
    .eq('reserved_quantity', row.reserved_quantity ?? 0)
  if (updErr) throw updErr

  const { error: ledErr } = await supabase.from('inventory_ledger').insert({
    sku,
    delta: qty,
    reason: 'reserve',
    idempotency_key: idempotencyKey,
  })
  if (ledErr && !/duplicate|unique/i.test(ledErr.message)) throw ledErr
  return true
}

export async function commitStock(
  sku: string,
  qty: number,
  orderId: string,
  idempotencyKey: string
): Promise<boolean> {
  const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('commit_inventory', {
    p_sku: sku,
    p_qty: qty,
    p_order_id: orderId,
    p_idempotency_key: idempotencyKey,
  })
  if (!error) return Boolean(data)

  const { data: existing } = await supabase
    .from('inventory_ledger')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing) return true

  const { data: row } = await supabase
    .from('inventory')
    .select('id, quantity, reserved_quantity')
    .eq('sku', sku)
    .maybeSingle()
  if (!row || (row.quantity ?? 0) < qty) return false

  const { error: updErr } = await supabase
    .from('inventory')
    .update({
      quantity: (row.quantity ?? 0) - qty,
      reserved_quantity: Math.max((row.reserved_quantity ?? 0) - qty, 0),
      updated_at: new Date().toISOString(),
    })
    .eq('sku', sku)
  if (updErr) throw updErr

  const { error: ledErr } = await supabase.from('inventory_ledger').insert({
    sku,
    order_id: orderId,
    delta: -qty,
    reason: 'commit',
    idempotency_key: idempotencyKey,
  })
  if (ledErr && !/duplicate|unique/i.test(ledErr.message)) throw ledErr
  return true
}

/** Undo a prior reserve (payment failure / checkout abort). Idempotent. */
export async function releaseStock(sku: string, qty: number, idempotencyKey: string): Promise<boolean> {
  const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase.rpc('release_inventory', {
    p_sku: sku,
    p_qty: qty,
    p_idempotency_key: idempotencyKey,
  })

  if (!error) return Boolean(data)

  // Fallback when RPC not yet migrated — still idempotent via ledger
  const { data: existing } = await supabase
    .from('inventory_ledger')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing) return true

  const { data: row } = await supabase
    .from('inventory')
    .select('id, reserved_quantity')
    .eq('sku', sku)
    .maybeSingle()
  if (!row) return false

  const nextReserved = Math.max((row.reserved_quantity ?? 0) - qty, 0)
  const { error: updErr } = await supabase
    .from('inventory')
    .update({ reserved_quantity: nextReserved, updated_at: new Date().toISOString() })
    .eq('sku', sku)
  if (updErr) throw updErr

  const { error: ledErr } = await supabase.from('inventory_ledger').insert({
    sku,
    delta: -qty,
    reason: 'release',
    idempotency_key: idempotencyKey,
  })
  if (ledErr && !/duplicate|unique/i.test(ledErr.message)) throw ledErr
  return true
}
