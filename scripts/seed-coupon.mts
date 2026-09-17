/**
 * Seed a demo coupon for Phase 7 testing.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env missing')

  const sb = createClient(url, key)
  const { data, error } = await sb
    .from('coupons')
    .upsert(
      {
        code: 'HOSGELDIN10',
        type: 'percent',
        value: 10,
        min_subtotal: 0,
        max_discount: 500,
        usage_limit: 1000,
        per_user_limit: 5,
        is_active: true,
      },
      { onConflict: 'code' }
    )
    .select('code,type,value')
    .single()

  if (error) throw error
  console.log('OK_COUPON', data)
}

main().catch((e) => {
  console.error('FAIL', e instanceof Error ? e.message : e)
  process.exit(1)
})
