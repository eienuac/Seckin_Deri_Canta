/**
 * Set CMS stock on product #1 and verify inventory sync + available stock.
 * Usage: npx tsx --env-file=.env.local scripts/set-product-stock.mts
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { getAvailableStock, syncProductInventory } from '../src/services/inventory/sync'

async function main() {
  const payload = await getPayload({ config })
  const stock = Number(process.env.SEED_STOCK || 40)

  const updated = await payload.update({
    collection: 'products',
    id: 1,
    data: { stock },
    locale: 'tr',
    overrideAccess: true,
  })

  console.log('product stock set to', (updated as { stock?: number }).stock)

  await syncProductInventory(updated as never)
  const available = await getAvailableStock('123')
  console.log('available stock for SKU 123:', available)

  if (available < 1) throw new Error('expected available stock > 0')
  console.log('OK')
  process.exit(0)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
