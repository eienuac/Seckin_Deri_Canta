/**
 * Phase 7 smoke checks: coupons validate, reviews list, shipping quote, returns schema.
 */
import fs from 'node:fs'
import path from 'node:path'

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    const val = m[2].trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

async function main() {
  loadEnvLocal()
  const base = process.env.SMOKE_BASE_URL || 'http://localhost:3000'

  const shipping = await fetch(`${base}/api/shipping/quote?subtotal=1000`).then((r) => r.json())
  console.log('shipping', shipping.methods?.map((m: { method: string; cost: number }) => `${m.method}:${m.cost}`).join(','))

  const reviews = await fetch(`${base}/api/reviews?productId=1`).then((r) => r.json())
  console.log('reviews', { count: reviews.count ?? 0, avg: reviews.averageRating ?? 0 })

  // Coupon validation via cart coupon needs a real cart — test service directly
  const { validateCoupon } = await import('../src/services/coupons/index.ts')
  const coupon = await validateCoupon({ code: 'HOSGELDIN10', subtotal: 2000 })
  console.log('coupon', coupon)

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const tables = ['reviews', 'coupons', 'return_requests', 'return_items', 'coupon_usages']
  for (const t of tables) {
    const { error, count } = await sb.from(t).select('*', { count: 'exact', head: true })
    console.log(`table:${t}`, error ? `ERR ${error.message}` : `ok count=${count ?? 0}`)
  }
}

main().catch((e) => {
  console.error('FAIL', e instanceof Error ? e.message : e)
  process.exit(1)
})
