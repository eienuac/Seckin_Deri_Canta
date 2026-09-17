/**
 * Set product #1 stock via SQL + sync quantity into public.inventory
 * Usage: npx tsx --env-file=.env.local scripts/set-product-stock-sql.mts
 */
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const { Client } = pg

async function main() {
  const stock = Number(process.env.SEED_STOCK || 40)
  const dbUrl = process.env.DATABASE_URL
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!dbUrl || !sbUrl || !service) throw new Error('Missing env')

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(`update payload.products set stock = $1 where id = 1`, [stock])
    const row = await client.query(`select id, sku, stock from payload.products where id = 1`)
    console.log('payload product', row.rows[0])
  } finally {
    await client.end()
  }

  const admin = createClient(sbUrl, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: existing } = await admin.from('inventory').select('*').eq('sku', '123').maybeSingle()
  if (existing) {
    const { error } = await admin
      .from('inventory')
      .update({ quantity: stock, product_id: '1', updated_at: new Date().toISOString() })
      .eq('sku', '123')
    if (error) throw error
  } else {
    const { error } = await admin.from('inventory').insert({
      sku: '123',
      product_id: '1',
      quantity: stock,
      reserved_quantity: 0,
    })
    if (error) throw error
  }

  const { data: inv } = await admin.from('inventory').select('sku,quantity,reserved_quantity').eq('sku', '123').single()
  console.log('inventory', inv)
  console.log('OK')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
