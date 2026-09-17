/**
 * Seed inventory for published Payload products (dev/bootstrap).
 * Usage: npx tsx --env-file=.env.local scripts/seed-inventory.mts
 */
import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const res = await fetch(`${site}/api/products?limit=50&locale=tr&depth=0&where[_status][equals]=published`)
  if (!res.ok) throw new Error(`Payload products fetch failed: ${res.status}`)
  const json = (await res.json()) as {
    docs: Array<{
      id: number | string
      sku?: string | null
      variants?: Array<{ id?: string | null; sku?: string | null }> | null
    }>
  }

  let upserted = 0
  for (const doc of json.docs ?? []) {
    const rows: Array<{ sku: string; product_id: string; variant_id: string | null }> = []
    if (doc.variants?.length) {
      for (const v of doc.variants) {
        if (!v?.sku) continue
        rows.push({
          sku: v.sku,
          product_id: String(doc.id),
          variant_id: v.id ? String(v.id) : v.sku,
        })
      }
    } else if (doc.sku) {
      rows.push({ sku: doc.sku, product_id: String(doc.id), variant_id: null })
    }

    for (const row of rows) {
      const { data: existing } = await admin.from('inventory').select('id,quantity').eq('sku', row.sku).maybeSingle()
      if (existing) {
        // Keep existing qty; only ensure identity fields
        await admin
          .from('inventory')
          .update({
            product_id: row.product_id,
            variant_id: row.variant_id,
            updated_at: new Date().toISOString(),
          })
          .eq('sku', row.sku)
        // If qty is 0 in bootstrap, give a working stock for Phase 4 testing
        if ((existing.quantity ?? 0) === 0) {
          await admin.from('inventory').update({ quantity: 25 }).eq('sku', row.sku)
        }
      } else {
        const { error } = await admin.from('inventory').insert({
          ...row,
          quantity: 25,
          reserved_quantity: 0,
        })
        if (error) throw new Error(`insert ${row.sku}: ${error.message}`)
      }
      upserted += 1
      console.log('inventory', row.sku, 'product', row.product_id)
    }
  }

  console.log('SEEDED', upserted)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
