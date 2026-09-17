/**
 * Align Phase 7 coupon/review/return columns with app expectations.
 */
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const { Client } = pg

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

const SQL = `
alter table public.coupons add column if not exists min_subtotal numeric(12,2) default 0;
alter table public.coupons add column if not exists max_discount numeric(12,2);
alter table public.coupons add column if not exists starts_at timestamptz;
alter table public.coupons add column if not exists ends_at timestamptz;
alter table public.coupons add column if not exists usage_limit integer;
alter table public.coupons add column if not exists per_user_limit integer default 1;
alter table public.coupons add column if not exists is_active boolean not null default true;
alter table public.coupons add column if not exists created_at timestamptz not null default now();

alter table public.reviews add column if not exists title text;
alter table public.reviews add column if not exists comment text;
alter table public.reviews add column if not exists verified_purchase boolean not null default true;
alter table public.reviews add column if not exists is_approved boolean not null default false;

alter table public.return_requests add column if not exists description text;
alter table public.return_requests add column if not exists admin_notes text;
alter table public.return_requests add column if not exists updated_at timestamptz not null default now();

notify pgrst, 'reload schema';
`

async function main() {
  loadEnvLocal()
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL missing')
  const ddlUrl = dbUrl.replace(':6543/', ':5432/')
  const client = new Client({ connectionString: ddlUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(SQL)
    const cols = await client.query(`
      select column_name from information_schema.columns
      where table_schema='public' and table_name='coupons'
      order by 1`)
    console.log('OK_COLS', cols.rows.map((r) => r.column_name).join(','))
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('FAIL', e instanceof Error ? e.message : e)
  process.exit(1)
})
