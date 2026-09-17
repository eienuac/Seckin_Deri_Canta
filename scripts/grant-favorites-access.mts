/**
 * Grant PostgREST roles access to ops tables + reload schema cache.
 * Usage: npx tsx --env-file=.env.local scripts/grant-favorites-access.mts
 */
import pg from 'pg'

const { Client } = pg

const SQL = `
grant usage on schema public to postgres, anon, authenticated, service_role;

grant select, insert, update, delete on table public.profiles to anon, authenticated, service_role;
grant all on table public.profiles to postgres, service_role;

grant select, insert, update, delete on table public.favorites to anon, authenticated, service_role;
grant all on table public.favorites to postgres, service_role;

alter table public.profiles enable row level security;
alter table public.favorites enable row level security;

-- Ensure policies exist (idempotent)
drop policy if exists "favorites_select_own" on public.favorites;
drop policy if exists "favorites_insert_own" on public.favorites;
drop policy if exists "favorites_delete_own" on public.favorites;
drop policy if exists "favorites_update_own" on public.favorites;
drop policy if exists "favorites_own" on public.favorites;

create policy "favorites_select_own" on public.favorites
  for select using (auth.uid() = user_id or public.is_admin());
create policy "favorites_insert_own" on public.favorites
  for insert with check (auth.uid() = user_id);
create policy "favorites_delete_own" on public.favorites
  for delete using (auth.uid() = user_id or public.is_admin());
create policy "favorites_update_own" on public.favorites
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
`

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL missing')

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(SQL)

    const grants = await client.query(`
      select grantee, privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'favorites'
      order by grantee, privilege_type
    `)
    console.log('favorites grants:')
    for (const row of grants.rows) {
      console.log(`  ${row.grantee}: ${row.privilege_type}`)
    }
    console.log('DONE')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
