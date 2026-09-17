/**
 * Apply missing checkout/payment/inventory schema to Supabase Postgres.
 * Reads DATABASE_URL from .env.local
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
  create type public.order_status as enum (
    'pending_payment','payment_received','preparing','shipped','delivered','cancelled','returned'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum (
    'pending','authorized','paid','failed','refunded','partially_refunded'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  product_id text not null,
  variant_id text,
  quantity integer not null default 0 check (quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  order_id uuid,
  delta integer not null,
  reason text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  guest_email text,
  cart_id uuid references public.carts(id) on delete set null,
  status public.order_status not null default 'pending_payment',
  payment_status public.payment_status not null default 'pending',
  subtotal numeric(12,2) not null,
  discount_total numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  currency text not null default 'TRY',
  coupon_code text,
  shipping_method text,
  shipping_address jsonb not null,
  billing_address jsonb,
  tracking_number text,
  notes text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null,
  product_name_snapshot text not null,
  product_sku_snapshot text not null,
  product_image_snapshot text,
  unit_price_snapshot numeric(12,2) not null,
  quantity integer not null check (quantity > 0),
  variant_snapshot jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  provider_payment_id text,
  amount numeric(12,2) not null,
  currency text not null default 'TRY',
  status public.payment_status not null default 'pending',
  raw_response jsonb,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percent','fixed')),
  value numeric(12,2) not null,
  min_subtotal numeric(12,2) default 0,
  max_uses integer,
  max_uses_per_user integer default 1,
  starts_at timestamptz,
  ends_at timestamptz,
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

alter table public.inventory enable row level security;
alter table public.inventory_ledger enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders for select using (
  auth.uid() = user_id or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
);

drop policy if exists order_items_select_own on public.order_items;
create policy order_items_select_own on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
);

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments for select using (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
);

grant select, insert, update, delete on public.orders to service_role;
grant select, insert, update, delete on public.order_items to service_role;
grant select, insert, update, delete on public.payments to service_role;
grant select, insert, update, delete on public.inventory to service_role;
grant select, insert, update, delete on public.inventory_ledger to service_role;
grant select, insert, update, delete on public.coupons to service_role;
grant select, insert, update, delete on public.coupon_usages to service_role;
`

async function main() {
  loadEnvLocal()
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL missing')

  // Prefer session pooler (5432) over transaction pooler (6543) for DDL
  const ddlUrl = dbUrl.replace(':6543/', ':5432/')

  const client = new Client({ connectionString: ddlUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    const before = await client.query(`
      select table_name from information_schema.tables
      where table_schema='public' and table_name in ('orders','payments','inventory','carts','favorites')
      order by 1`)
    console.log('BEFORE', before.rows.map((r) => r.table_name).join(','))

    await client.query(SQL)

    const rpcPath = path.join(process.cwd(), 'supabase/migrations/002_checkout_stock_release.sql')
    // Apply only function definitions (skip alter if already in SQL above)
    const rpcSql = fs.readFileSync(rpcPath, 'utf8')
    await client.query(rpcSql)

    const after = await client.query(`
      select table_name from information_schema.tables
      where table_schema='public' and table_name in ('orders','payments','inventory','order_items')
      order by 1`)
    console.log('AFTER', after.rows.map((r) => r.table_name).join(','))
    console.log('OK_CHECKOUT_SCHEMA')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('FAIL', e instanceof Error ? e.message : e)
  process.exit(1)
})
