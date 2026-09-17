/**
 * Ensure Phase 7 tables exist (reviews, coupons, returns).
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
create extension if not exists "pgcrypto";

do $$ begin
  create type public.return_status as enum (
    'requested','reviewing','approved','rejected','awaiting_shipment','received','refunded'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percent','fixed')),
  value numeric(12,2) not null,
  min_subtotal numeric(12,2) default 0,
  max_discount numeric(12,2),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  per_user_limit integer default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.coupon_usages (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  order_id uuid,
  guest_email text,
  used_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  title text,
  comment text,
  verified_purchase boolean not null default true,
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, product_id, order_id)
);

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.return_status not null default 'requested',
  reason text not null,
  description text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.return_requests(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  photo_urls text[] default '{}'
);

alter table public.coupons enable row level security;
alter table public.coupon_usages enable row level security;
alter table public.reviews enable row level security;
alter table public.return_requests enable row level security;
alter table public.return_items enable row level security;

grant select, insert, update, delete on public.coupons to service_role;
grant select, insert, update, delete on public.coupon_usages to service_role;
grant select, insert, update, delete on public.reviews to service_role;
grant select, insert, update, delete on public.return_requests to service_role;
grant select, insert, update, delete on public.return_items to service_role;
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
    const r = await client.query(`
      select table_name from information_schema.tables
      where table_schema='public'
        and table_name in ('reviews','coupons','coupon_usages','return_requests','return_items')
      order by 1`)
    console.log('OK_PHASE7', r.rows.map((x) => x.table_name).join(','))
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('FAIL', e instanceof Error ? e.message : e)
  process.exit(1)
})
