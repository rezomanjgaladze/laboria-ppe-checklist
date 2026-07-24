-- Laboria Orbit billing persistence for Lemon Squeezy.
-- Apply before enabling checkout or registering the production webhook.

create extension if not exists pgcrypto;

create table if not exists public.orbit_billing_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'Orbit Starter'
    check (plan in ('Orbit Starter', 'Orbit Plus', 'Orbit Pro')),
  subscription_status text not null default 'inactive',
  ai_credits_balance integer not null default 0
    check (ai_credits_balance >= 0),
  current_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orbit_billing_accounts
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists ai_credits_balance integer not null default 0,
  add column if not exists current_period_ends_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'lemon' check (provider = 'lemon'),
  lemon_customer_id text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, lemon_customer_id),
  unique (provider, user_id)
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'lemon' check (provider = 'lemon'),
  lemon_customer_id text,
  lemon_subscription_id text not null unique,
  lemon_order_id text,
  lemon_variant_id text,
  product_type text not null
    check (product_type in ('plus_subscription', 'pro_subscription')),
  plan text not null
    check (plan in ('Orbit Plus', 'Orbit Pro')),
  status text not null,
  renews_at timestamptz,
  ends_at timestamptz,
  trial_ends_at timestamptz,
  update_payment_method_url text,
  customer_portal_url text,
  last_credit_period_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'lemon' check (provider = 'lemon'),
  lemon_order_id text not null unique,
  lemon_customer_id text,
  lemon_variant_id text,
  product_type text not null
    check (product_type in (
      'plus_subscription',
      'pro_subscription',
      'starter_topup',
      'plus_pack',
      'pro_pack'
    )),
  amount_total integer,
  currency text,
  status text not null,
  credits_granted integer not null default 0
    check (credits_granted >= 0),
  ordered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'lemon' check (provider = 'lemon'),
  provider_event_key text not null unique,
  lemon_event_id text,
  event_name text not null,
  user_id uuid references auth.users(id) on delete set null,
  raw_payload jsonb not null,
  processing_status text not null default 'processing'
    check (processing_status in ('processing', 'processed', 'ignored', 'failed')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  entry_key text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text,
  source text not null,
  product_type text,
  amount integer not null,
  reason text not null,
  provider_reference text,
  created_at timestamptz not null default now()
);

create index if not exists billing_subscriptions_user_id_idx
  on public.billing_subscriptions (user_id, updated_at desc);
create index if not exists billing_orders_user_id_idx
  on public.billing_orders (user_id, ordered_at desc);
create index if not exists billing_events_user_id_idx
  on public.billing_events (user_id, created_at desc);
create index if not exists ai_credit_ledger_user_id_idx
  on public.ai_credit_ledger (user_id, created_at desc);

alter table public.orbit_billing_accounts enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_orders enable row level security;
alter table public.billing_events enable row level security;
alter table public.ai_credit_ledger enable row level security;

drop policy if exists "Users can read their own billing account"
  on public.orbit_billing_accounts;
create policy "Users can read their own billing account"
on public.orbit_billing_accounts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own billing customer"
  on public.billing_customers;
create policy "Users can read their own billing customer"
on public.billing_customers
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own subscriptions"
  on public.billing_subscriptions;
create policy "Users can read their own subscriptions"
on public.billing_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own billing orders"
  on public.billing_orders;
create policy "Users can read their own billing orders"
on public.billing_orders
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own AI credit ledger"
  on public.ai_credit_ledger;
create policy "Users can read their own AI credit ledger"
on public.ai_credit_ledger
for select
to authenticated
using (auth.uid() = user_id);

revoke all on public.orbit_billing_accounts from anon, authenticated;
revoke all on public.billing_customers from anon, authenticated;
revoke all on public.billing_subscriptions from anon, authenticated;
revoke all on public.billing_orders from anon, authenticated;
revoke all on public.billing_events from anon, authenticated;
revoke all on public.ai_credit_ledger from anon, authenticated;

grant select on public.orbit_billing_accounts to authenticated;
grant select on public.billing_customers to authenticated;
grant select on public.billing_subscriptions to authenticated;
grant select on public.billing_orders to authenticated;
grant select on public.ai_credit_ledger to authenticated;

grant all on public.orbit_billing_accounts to service_role;
grant all on public.billing_customers to service_role;
grant all on public.billing_subscriptions to service_role;
grant all on public.billing_orders to service_role;
grant all on public.billing_events to service_role;
grant all on public.ai_credit_ledger to service_role;

drop function if exists public.grant_orbit_ai_credits(
  uuid, integer, text, text, text
);

create or replace function public.grant_orbit_ai_credits(
  p_user_id uuid,
  p_credits integer,
  p_reason text,
  p_entry_key text,
  p_provider_reference text default null,
  p_provider text default null,
  p_product_type text default null,
  p_source text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted_count integer := 0;
  v_account public.orbit_billing_accounts%rowtype;
begin
  if p_user_id is null or p_credits <= 0 or nullif(p_entry_key, '') is null then
    raise exception 'Invalid Orbit AI credit grant';
  end if;

  insert into public.orbit_billing_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  insert into public.ai_credit_ledger (
    entry_key,
    user_id,
    provider,
    source,
    product_type,
    amount,
    reason,
    provider_reference
  )
  values (
    p_entry_key,
    p_user_id,
    nullif(p_provider, ''),
    coalesce(nullif(p_source, ''), 'manual'),
    nullif(p_product_type, ''),
    p_credits,
    coalesce(nullif(p_reason, ''), 'Orbit AI credit grant'),
    nullif(p_provider_reference, '')
  )
  on conflict (entry_key) do nothing;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count > 0 then
    update public.orbit_billing_accounts
    set
      ai_credits_balance = ai_credits_balance + p_credits,
      updated_at = now()
    where user_id = p_user_id;
  end if;

  select *
  into v_account
  from public.orbit_billing_accounts
  where user_id = p_user_id;

  return jsonb_build_object(
    'granted', v_inserted_count > 0,
    'duplicate', v_inserted_count = 0,
    'plan', v_account.plan,
    'credits', v_account.ai_credits_balance
  );
end;
$$;

create or replace function public.spend_orbit_ai_credits(
  p_user_id uuid,
  p_credits integer,
  p_reason text,
  p_entry_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted_count integer := 0;
  v_account public.orbit_billing_accounts%rowtype;
begin
  if p_user_id is null or p_credits <= 0 or nullif(p_entry_key, '') is null then
    raise exception 'Invalid Orbit AI credit spend';
  end if;

  insert into public.orbit_billing_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.orbit_billing_accounts
  set
    ai_credits_balance = ai_credits_balance - p_credits,
    updated_at = now()
  where user_id = p_user_id
    and ai_credits_balance >= p_credits
  returning *
  into v_account;

  if not found then
    select *
    into v_account
    from public.orbit_billing_accounts
    where user_id = p_user_id;

    return jsonb_build_object(
      'spent', false,
      'insufficient', true,
      'plan', v_account.plan,
      'credits', v_account.ai_credits_balance
    );
  end if;

  insert into public.ai_credit_ledger (
    entry_key,
    user_id,
    source,
    amount,
    reason
  )
  values (
    p_entry_key,
    p_user_id,
    'ai_generation',
    -p_credits,
    coalesce(nullif(p_reason, ''), 'Orbit AI credit spend')
  )
  on conflict (entry_key) do nothing;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count = 0 then
    update public.orbit_billing_accounts
    set
      ai_credits_balance = ai_credits_balance + p_credits,
      updated_at = now()
    where user_id = p_user_id
    returning *
    into v_account;

    return jsonb_build_object(
      'spent', false,
      'duplicate', true,
      'plan', v_account.plan,
      'credits', v_account.ai_credits_balance
    );
  end if;

  return jsonb_build_object(
    'spent', true,
    'plan', v_account.plan,
    'credits', v_account.ai_credits_balance
  );
end;
$$;

revoke all on function public.grant_orbit_ai_credits(
  uuid, integer, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.spend_orbit_ai_credits(
  uuid, integer, text, text
) from public, anon, authenticated;

grant execute on function public.grant_orbit_ai_credits(
  uuid, integer, text, text, text, text, text, text
) to service_role;
grant execute on function public.spend_orbit_ai_credits(
  uuid, integer, text, text
) to service_role;
