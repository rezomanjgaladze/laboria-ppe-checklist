-- Laboria Orbit staged Paddle Billing persistence.
-- Apply before enabling checkout. Client-side checkout success never grants access.

create table if not exists public.orbit_billing_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'Orbit Starter'
    check (plan in ('Orbit Starter', 'Orbit Plus', 'Orbit Pro')),
  subscription_status text not null default 'inactive',
  paddle_customer_id text,
  paddle_subscription_id text,
  ai_credits_balance integer not null default 0
    check (ai_credits_balance >= 0),
  current_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orbit_paddle_checkout_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null,
  purchase_type text not null
    check (purchase_type in ('subscription', 'credit_pack')),
  price_id text not null,
  requested_plan text,
  requested_credits integer not null default 0
    check (requested_credits >= 0),
  status text not null default 'pending',
  paddle_transaction_id text,
  paddle_subscription_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.orbit_billing_transactions (
  paddle_transaction_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  checkout_attempt_id uuid references public.orbit_paddle_checkout_attempts(id),
  item_key text not null,
  purchase_type text not null,
  paddle_customer_id text,
  paddle_subscription_id text,
  currency_code text,
  total_amount text,
  created_at timestamptz not null default now()
);

create table if not exists public.orbit_ai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  entry_key text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  credits_delta integer not null,
  reason text not null,
  paddle_transaction_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.orbit_paddle_webhook_events (
  event_id text primary key,
  event_type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  status text not null default 'processing',
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.orbit_billing_accounts enable row level security;
alter table public.orbit_paddle_checkout_attempts enable row level security;
alter table public.orbit_billing_transactions enable row level security;
alter table public.orbit_ai_credit_ledger enable row level security;
alter table public.orbit_paddle_webhook_events enable row level security;

drop policy if exists "Users can read their own billing account" on public.orbit_billing_accounts;
create policy "Users can read their own billing account"
on public.orbit_billing_accounts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own checkout attempts" on public.orbit_paddle_checkout_attempts;
create policy "Users can read their own checkout attempts"
on public.orbit_paddle_checkout_attempts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own billing transactions" on public.orbit_billing_transactions;
create policy "Users can read their own billing transactions"
on public.orbit_billing_transactions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read their own AI credit ledger" on public.orbit_ai_credit_ledger;
create policy "Users can read their own AI credit ledger"
on public.orbit_ai_credit_ledger
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.process_orbit_paddle_webhook(
  p_event_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_status text;
  v_data jsonb := coalesce(p_payload -> 'data', '{}'::jsonb);
  v_custom_data jsonb := coalesce(v_data -> 'custom_data', '{}'::jsonb);
  v_attempt_id uuid;
  v_attempt public.orbit_paddle_checkout_attempts%rowtype;
  v_subscription_status text := coalesce(v_data ->> 'status', 'unknown');
  v_credits_granted integer := 0;
  v_inserted_count integer := 0;
begin
  select status
  into v_existing_status
  from public.orbit_paddle_webhook_events
  where event_id = p_event_id;

  if v_existing_status in ('processed', 'ignored') then
    return jsonb_build_object(
      'duplicate', true,
      'eventId', p_event_id,
      'status', v_existing_status
    );
  end if;

  insert into public.orbit_paddle_webhook_events (
    event_id,
    event_type,
    occurred_at,
    payload,
    status
  )
  values (
    p_event_id,
    p_event_type,
    p_occurred_at,
    p_payload,
    'processing'
  )
  on conflict (event_id) do update
  set
    event_type = excluded.event_type,
    occurred_at = excluded.occurred_at,
    payload = excluded.payload,
    status = 'processing',
    last_error = null;

  begin
    v_attempt_id := nullif(v_custom_data ->> 'orbit_checkout_attempt_id', '')::uuid;
  exception
    when invalid_text_representation then
      v_attempt_id := null;
  end;

  if v_attempt_id is null then
    update public.orbit_paddle_webhook_events
    set status = 'ignored', processed_at = now()
    where event_id = p_event_id;

    return jsonb_build_object(
      'ignored', true,
      'reason', 'No Laboria Orbit checkout attempt reference'
    );
  end if;

  select *
  into v_attempt
  from public.orbit_paddle_checkout_attempts
  where id = v_attempt_id;

  if not found then
    update public.orbit_paddle_webhook_events
    set status = 'ignored', processed_at = now()
    where event_id = p_event_id;

    return jsonb_build_object(
      'ignored', true,
      'reason', 'Unknown Laboria Orbit checkout attempt'
    );
  end if;

  insert into public.orbit_billing_accounts (user_id)
  values (v_attempt.user_id)
  on conflict (user_id) do nothing;

  if p_event_type = 'transaction.completed' then
    insert into public.orbit_billing_transactions (
      paddle_transaction_id,
      user_id,
      checkout_attempt_id,
      item_key,
      purchase_type,
      paddle_customer_id,
      paddle_subscription_id,
      currency_code,
      total_amount
    )
    values (
      v_data ->> 'id',
      v_attempt.user_id,
      v_attempt.id,
      v_attempt.item_key,
      v_attempt.purchase_type,
      v_data ->> 'customer_id',
      v_data ->> 'subscription_id',
      v_data ->> 'currency_code',
      v_data -> 'details' -> 'totals' ->> 'total'
    )
    on conflict (paddle_transaction_id) do nothing;

    update public.orbit_paddle_checkout_attempts
    set
      status = 'completed',
      paddle_transaction_id = v_data ->> 'id',
      paddle_subscription_id = v_data ->> 'subscription_id',
      completed_at = now()
    where id = v_attempt.id;

    if v_attempt.purchase_type = 'credit_pack' then
      insert into public.orbit_ai_credit_ledger (
        entry_key,
        user_id,
        credits_delta,
        reason,
        paddle_transaction_id
      )
      values (
        'paddle:' || (v_data ->> 'id') || ':' || v_attempt.item_key,
        v_attempt.user_id,
        v_attempt.requested_credits,
        'Paddle AI credit pack purchase: ' || v_attempt.item_key,
        v_data ->> 'id'
      )
      on conflict (entry_key) do nothing;

      get diagnostics v_inserted_count = row_count;

      if v_inserted_count > 0 then
        update public.orbit_billing_accounts
        set
          ai_credits_balance = ai_credits_balance + v_attempt.requested_credits,
          paddle_customer_id = coalesce(v_data ->> 'customer_id', paddle_customer_id),
          updated_at = now()
        where user_id = v_attempt.user_id;

        v_credits_granted := v_attempt.requested_credits;
      end if;
    end if;
  elsif p_event_type in (
    'subscription.activated',
    'subscription.updated',
    'subscription.canceled'
  ) then
    update public.orbit_billing_accounts
    set
      plan = case
        when v_subscription_status = 'canceled' then 'Orbit Starter'
        else coalesce(v_attempt.requested_plan, plan)
      end,
      subscription_status = v_subscription_status,
      paddle_customer_id = coalesce(v_data ->> 'customer_id', paddle_customer_id),
      paddle_subscription_id = coalesce(v_data ->> 'id', paddle_subscription_id),
      current_period_ends_at = nullif(
        v_data -> 'current_billing_period' ->> 'ends_at',
        ''
      )::timestamptz,
      updated_at = now()
    where user_id = v_attempt.user_id;

    update public.orbit_paddle_checkout_attempts
    set
      status = v_subscription_status,
      paddle_subscription_id = v_data ->> 'id'
    where id = v_attempt.id;
  else
    update public.orbit_paddle_webhook_events
    set status = 'ignored', processed_at = now()
    where event_id = p_event_id;

    return jsonb_build_object(
      'ignored', true,
      'reason', 'Event type does not change Orbit billing state'
    );
  end if;

  update public.orbit_paddle_webhook_events
  set status = 'processed', processed_at = now()
  where event_id = p_event_id;

  return jsonb_build_object(
    'processed', true,
    'eventId', p_event_id,
    'eventType', p_event_type,
    'creditsGranted', v_credits_granted
  );
exception
  when others then
    update public.orbit_paddle_webhook_events
    set status = 'failed', last_error = sqlerrm
    where event_id = p_event_id;
    raise;
end;
$$;

revoke all on function public.process_orbit_paddle_webhook(text, text, timestamptz, jsonb)
from public, anon, authenticated;
grant execute on function public.process_orbit_paddle_webhook(text, text, timestamptz, jsonb)
to service_role;
