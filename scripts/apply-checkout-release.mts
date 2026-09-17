/**
 * Apply Phase 5-6 checkout stock release migration.
 * Usage: npx tsx --env-file=.env.local scripts/apply-checkout-release.mts
 * (or load env in shell first on Windows)
 */
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const { Client } = pg

async function main() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL missing')

  const sqlPath = path.join(process.cwd(), 'supabase/migrations/002_checkout_stock_release.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(sql)
    console.log('OK applied 002_checkout_stock_release.sql')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('FAIL', e instanceof Error ? e.message : e)
  process.exit(1)
})
