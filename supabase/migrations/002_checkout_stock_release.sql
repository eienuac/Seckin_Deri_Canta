-- Phase 5-6 inventory RPCs (run in Supabase SQL Editor if not yet applied)

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

create or replace function public.release_inventory(
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
  set reserved_quantity = greatest(reserved_quantity - p_qty, 0),
      updated_at = now()
  where sku = p_sku;

  get diagnostics updated_rows = row_count;
  if updated_rows = 0 then
    return false;
  end if;

  insert into public.inventory_ledger (sku, delta, reason, idempotency_key)
  values (p_sku, -p_qty, 'release', p_idempotency_key);

  return true;
end;
$$;

grant execute on function public.reserve_inventory(text, integer, text) to service_role;
grant execute on function public.commit_inventory(text, integer, uuid, text) to service_role;
grant execute on function public.release_inventory(text, integer, text) to service_role;

-- Optional: link orders → carts for cleanup after payment
alter table public.orders
  add column if not exists cart_id uuid references public.carts(id) on delete set null;
