/**
 * Apply carts + cart_items + inventory tables, RLS, grants.
 * Usage: npx tsx --env-file=.env.local scripts/apply-cart-schema.mts
 */
import pg from 'pg'

const { Client } = pg

const SQL = `
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  product_id text not null,
  variant_id text,
  quantity integer not null default 0 check (quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  updated_at timestamptz not null default now(),
  constraint inventory_available_check check (quantity >= reserved_quantity)
);

create index if not exists inventory_product_id_idx on public.inventory(product_id);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  guest_token text unique,
  coupon_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carts_owner_check check (user_id is not null or guest_token is not null)
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id text not null,
  variant_id text,
  sku text not null,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, sku)
);

create table if not exists public.inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  order_id uuid,
  delta integer not null,
  reason text not null,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.inventory enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.inventory_ledger enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Cart policies: own carts + service_role via grants (API uses service role)
drop policy if exists "carts_own" on public.carts;
create policy "carts_own" on public.carts
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- Allow guest cart rows to be managed only via service role (no auth.uid),
-- so we add a permissive policy for select of own user carts only above.
-- Service role bypasses RLS.

drop policy if exists "cart_items_via_cart" on public.cart_items;
create policy "cart_items_via_cart" on public.cart_items
  for all using (
    exists (
      select 1 from public.carts c
      where c.id = cart_id and (c.user_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.carts c
      where c.id = cart_id and (c.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "inventory_read" on public.inventory;
create policy "inventory_read" on public.inventory for select using (true);

drop policy if exists "inventory_admin_write" on public.inventory;
create policy "inventory_admin_write" on public.inventory
  for all using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to postgres, anon, authenticated, service_role;

grant select, insert, update, delete on table public.carts to anon, authenticated, service_role;
grant all on table public.carts to postgres, service_role;

grant select, insert, update, delete on table public.cart_items to anon, authenticated, service_role;
grant all on table public.cart_items to postgres, service_role;

grant select on table public.inventory to anon, authenticated, service_role;
grant all on table public.inventory to postgres, service_role;

grant select, insert on table public.inventory_ledger to authenticated, service_role;
grant all on table public.inventory_ledger to postgres, service_role;

grant select, insert, update, delete on table public.profiles to anon, authenticated, service_role;
grant all on table public.profiles to postgres, service_role;

notify pgrst, 'reload schema';
`

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL missing')

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(SQL)
    const tables = await client.query(`
      select table_name from information_schema.tables
      where table_schema='public' and table_name in ('carts','cart_items','inventory','inventory_ledger')
      order by table_name
    `)
    console.log('Tables:', tables.rows.map((r) => r.table_name).join(', '))
    console.log('DONE')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
