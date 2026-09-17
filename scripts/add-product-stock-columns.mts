/**
 * Add stock columns to Payload products + drafts/versions tables.
 * Usage: npx tsx --env-file=.env.local scripts/add-product-stock-columns.mts
 */
import pg from 'pg'

const { Client } = pg

const SQL = `
-- Live product stock
alter table if exists payload.products
  add column if not exists stock numeric default 0;
update payload.products set stock = 0 where stock is null;

-- Live variant stock
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'payload' and table_name = 'products_variants'
  ) then
    alter table payload.products_variants
      add column if not exists stock numeric default 0;
    update payload.products_variants set stock = 0 where stock is null;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'payload'
        and table_name = 'products_variants'
        and column_name = 'inventory_ref'
    ) then
      alter table payload.products_variants drop column inventory_ref;
    end if;
  end if;
end $$;

-- Versions / drafts: product-level stock
alter table if exists payload._products_v
  add column if not exists version_stock numeric default 0;
update payload._products_v set version_stock = 0 where version_stock is null;

-- Versions / drafts: variant-level stock
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'payload' and table_name = '_products_v_version_variants'
  ) then
    alter table payload._products_v_version_variants
      add column if not exists stock numeric default 0;
    update payload._products_v_version_variants set stock = 0 where stock is null;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'payload'
        and table_name = '_products_v_version_variants'
        and column_name = 'inventory_ref'
    ) then
      alter table payload._products_v_version_variants drop column inventory_ref;
    end if;
  end if;
end $$;
`

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL missing')
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(SQL)
    const cols = await client.query(`
      select table_name, column_name, data_type
      from information_schema.columns
      where table_schema = 'payload'
        and column_name in ('stock', 'version_stock', 'inventory_ref')
        and table_name in (
          'products',
          'products_variants',
          '_products_v',
          '_products_v_version_variants'
        )
      order by table_name, column_name
    `)
    console.log(cols.rows)
    console.log('DONE')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
