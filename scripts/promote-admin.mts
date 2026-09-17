/**
 * Promote a Supabase user to app-admin by email.
 * Usage: npx tsx scripts/promote-admin.mts you@email.com
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
  const email = (process.argv[2] || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    console.error('Usage: npx tsx scripts/promote-admin.mts you@email.com')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env missing')

  const sb = createClient(url, key)
  const { data: profile, error } = await sb
    .from('profiles')
    .update({ role: 'admin', updated_at: new Date().toISOString() })
    .ilike('email', email)
    .select('id, email, role')
    .maybeSingle()

  if (error) throw error
  if (!profile) {
    console.error(`No profile found for ${email}. Register/login once on the storefront first.`)
    process.exit(1)
  }

  console.log('OK_PROMOTED', { email: profile.email, role: profile.role })
  console.log('Also add this email to ADMIN_EMAILS in .env.local if you want env-based access.')
}

main().catch((e) => {
  console.error('FAIL', e instanceof Error ? e.message : e)
  process.exit(1)
})
