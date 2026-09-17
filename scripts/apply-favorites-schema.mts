/**
 * Apply missing public ops tables (favorites etc.) to Supabase Postgres.
 * Loads credentials from .env.local — do not pass secrets on the CLI.
 *
 * Usage: npx tsx --env-file=.env.local scripts/apply-favorites-schema.mts
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

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

alter table public.profiles enable row level security;
alter table public.favorites enable row level security;

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

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "favorites_own" on public.favorites;
drop policy if exists "favorites_select_own" on public.favorites;
drop policy if exists "favorites_insert_own" on public.favorites;
drop policy if exists "favorites_delete_own" on public.favorites;
drop policy if exists "favorites_update_own" on public.favorites;

create policy "favorites_select_own" on public.favorites
  for select using (auth.uid() = user_id or public.is_admin());

create policy "favorites_insert_own" on public.favorites
  for insert with check (auth.uid() = user_id);

create policy "favorites_delete_own" on public.favorites
  for delete using (auth.uid() = user_id or public.is_admin());

create policy "favorites_update_own" on public.favorites
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
  )
  on conflict (id) do update set
    email = excluded.email,
    first_name = coalesce(nullif(excluded.first_name, ''), public.profiles.first_name),
    last_name = coalesce(nullif(excluded.last_name, ''), public.profiles.last_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for existing auth users
insert into public.profiles (id, email, first_name, last_name)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'first_name', ''),
  coalesce(u.raw_user_meta_data->>'last_name', '')
from auth.users u
on conflict (id) do nothing;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant select, insert, update, delete on table public.profiles to anon, authenticated, service_role;
grant all on table public.profiles to postgres, service_role;
grant select, insert, update, delete on table public.favorites to anon, authenticated, service_role;
grant all on table public.favorites to postgres, service_role;

notify pgrst, 'reload schema';
`

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is missing')
  }

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  try {
    await client.query(SQL)

    const tables = await client.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_name in ('favorites', 'profiles')
      order by table_name
    `)
    console.log(
      'Tables ready:',
      tables.rows.map((r) => r.table_name).join(', ')
    )

    const policies = await client.query(`
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = 'favorites'
      order by policyname
    `)
    console.log(
      'Favorites policies:',
      policies.rows.map((r) => r.policyname).join(', ')
    )

    const profileCount = await client.query(`select count(*)::int as n from public.profiles`)
    console.log('Profiles count:', profileCount.rows[0]?.n)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('[apply-favorites-schema]', err instanceof Error ? err.message : err)
  process.exit(1)
})
