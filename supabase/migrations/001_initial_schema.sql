-- Seçkin Çanta — Supabase schema (ops data)
-- CMS product content lives in Payload; only inventory SKUs sync here.

create extension if not exists "pgcrypto";

-- Profiles
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

-- Addresses
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  first_name text not null,
  last_name text not null,
  phone text not null,
  city text not null,
  district text,
  neighborhood text,
  address_line text not null,
  postal_code text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Inventory (SKU is source of truth for stock; product_id is Payload ID string)
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

-- Carts
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

-- Favorites
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- Coupons
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percent', 'fixed')),
  value numeric(12,2) not null check (value > 0),
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

-- Orders
create type public.order_status as enum (
  'pending_payment',
  'payment_received',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
  'returned'
);

create type public.payment_status as enum (
  'pending',
  'authorized',
  'paid',
  'failed',
  'refunded',
  'partially_refunded'
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  guest_email text,
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

-- Payments
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

-- Reviews
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

-- Returns
create type public.return_status as enum (
  'requested',
  'reviewing',
  'approved',
  'rejected',
  'awaiting_shipment',
  'received',
  'refunded'
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

-- Inventory ledger for idempotent stock ops
create table if not exists public.inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  order_id uuid,
  delta integer not null,
  reason text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

-- Atomic reserve stock
create or replace function public.reserve_inventory(
  p_sku text,
  p_qty integer,
  p_idempotency_key text
) returns boolean
language plpgsql
as $$
declare
  updated_rows integer;
begin
  if exists (select 1 from public.inventory_ledger where idempotency_key = p_idempotency_key) then
    return true;
  end if;

  update public.inventory
  set reserved_quantity = reserved_quantity + p_qty,
      updated_at = now()
  where sku = p_sku
    and (quantity - reserved_quantity) >= p_qty;

  get diagnostics updated_rows = row_count;
  if updated_rows = 0 then
    return false;
  end if;

  insert into public.inventory_ledger (sku, delta, reason, idempotency_key)
  values (p_sku, p_qty, 'reserve', p_idempotency_key);

  return true;
end;
$$;

-- Atomic commit (decrement after payment)
create or replace function public.commit_inventory(
  p_sku text,
  p_qty integer,
  p_order_id uuid,
  p_idempotency_key text
) returns boolean
language plpgsql
as $$
begin
  if exists (select 1 from public.inventory_ledger where idempotency_key = p_idempotency_key) then
    return true;
  end if;

  update public.inventory
  set quantity = quantity - p_qty,
      reserved_quantity = greatest(reserved_quantity - p_qty, 0),
      updated_at = now()
  where sku = p_sku
    and quantity >= p_qty;

  if not found then
    return false;
  end if;

  insert into public.inventory_ledger (sku, order_id, delta, reason, idempotency_key)
  values (p_sku, p_order_id, -p_qty, 'commit', p_idempotency_key);

  return true;
end;
$$;

-- Profile bootstrap
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.favorites enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.return_requests enable row level security;
alter table public.return_items enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_usages enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_ledger enable row level security;

-- Helper: is admin
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

-- Profiles policies
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Addresses
create policy "addresses_own" on public.addresses for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());

-- Favorites (explicit per-command policies + grants for PostgREST roles)
grant select, insert, update, delete on table public.favorites to anon, authenticated, service_role;
grant select, insert, update, delete on table public.profiles to anon, authenticated, service_role;

drop policy if exists "favorites_own" on public.favorites;
create policy "favorites_select_own" on public.favorites
  for select using (auth.uid() = user_id or public.is_admin());
create policy "favorites_insert_own" on public.favorites
  for insert with check (auth.uid() = user_id);
create policy "favorites_delete_own" on public.favorites
  for delete using (auth.uid() = user_id or public.is_admin());
create policy "favorites_update_own" on public.favorites
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Carts
create policy "carts_own" on public.carts for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create policy "cart_items_via_cart" on public.cart_items for all using (
  exists (select 1 from public.carts c where c.id = cart_id and (c.user_id = auth.uid() or public.is_admin()))
) with check (
  exists (select 1 from public.carts c where c.id = cart_id and (c.user_id = auth.uid() or public.is_admin()))
);

-- Orders
create policy "orders_select_own" on public.orders for select using (auth.uid() = user_id or public.is_admin());
create policy "order_items_select" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
create policy "payments_select" on public.payments for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);

-- Reviews: public read approved; write own
create policy "reviews_read_approved" on public.reviews for select using (is_approved = true or auth.uid() = user_id or public.is_admin());
create policy "reviews_insert_own" on public.reviews for insert with check (auth.uid() = user_id);
create policy "reviews_admin" on public.reviews for update using (public.is_admin());

-- Returns
create policy "returns_own" on public.return_requests for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create policy "return_items_own" on public.return_items for all using (
  exists (
    select 1 from public.return_requests r
    where r.id = return_request_id and (r.user_id = auth.uid() or public.is_admin())
  )
);

-- Coupons: authenticated can read active (validation still server-side)
create policy "coupons_read_active" on public.coupons for select using (is_active = true or public.is_admin());
create policy "coupons_admin" on public.coupons for all using (public.is_admin()) with check (public.is_admin());

-- Inventory: public can read availability; writes via service role
create policy "inventory_read" on public.inventory for select using (true);

-- Storage bucket for return photos (run in dashboard if needed)
-- insert into storage.buckets (id, name, public) values ('return-photos', 'return-photos', false);
