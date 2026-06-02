-- Laboria Orbit billing entitlement and monthly AI credit processing.
-- Applies after 20260602_paddle_billing_staged.sql.

create or replace function public.get_orbit_included_monthly_credits(p_plan text)
returns integer
language sql
immutable
as $$
  select case
    when p_plan = 'Orbit Plus' then 100
    when p_plan = 'Orbit Pro' then 300
    else 0
  end;
$$;

create or replace function public.grant_orbit_ai_credits(
  p_user_id uuid,
  p_credits integer,
  p_reason text,
  p_entry_key text,
  p_paddle_transaction_id text default null
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

  insert into public.orbit_ai_credit_ledger (
    entry_key,
    user_id,
    credits_delta,
    reason,
    paddle_transaction_id
  )
  values (
    p_entry_key,
    p_user_id,
    p_credits,
    coalesce(nullif(p_reason, ''), 'Orbit AI credit grant'),
    p_paddle_transaction_id
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

  insert into public.orbit_ai_credit_ledger (
    entry_key,
    user_id,
    credits_delta,
    reason
  )
  values (
    p_entry_key,
    p_user_id,
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

create or replace function public.grant_orbit_subscription_monthly_credits(
  p_user_id uuid,
  p_plan text,
  p_subscription_id text,
  p_period_key text,
  p_paddle_transaction_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits integer := public.get_orbit_included_monthly_credits(p_plan);
  v_entry_key text;
begin
  if v_credits <= 0 then
    return jsonb_build_object('granted', false, 'credits', 0);
  end if;

  v_entry_key :=
    'paddle-subscription-credit:' ||
    coalesce(nullif(p_subscription_id, ''), 'unknown-subscription') ||
    ':' ||
    p_plan ||
    ':' ||
    coalesce(nullif(p_period_key, ''), coalesce(nullif(p_paddle_transaction_id, ''), 'unknown-period'));

  return public.grant_orbit_ai_credits(
    p_user_id,
    v_credits,
    p_plan || ' included monthly AI credits',
    v_entry_key,
    p_paddle_transaction_id
  );
end;
$$;

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
  v_attempt_found boolean := false;
  v_event_subscription_id text;
  v_event_transaction_id text := v_data ->> 'id';
  v_customer_id text := v_data ->> 'customer_id';
  v_subscription_status text := coalesce(v_data ->> 'status', 'active');
  v_user_id uuid;
  v_purchase_type text;
  v_item_key text;
  v_requested_plan text;
  v_requested_credits integer := 0;
  v_plan text;
  v_period_key text;
  v_credit_result jsonb := '{}'::jsonb;
  v_credits_granted integer := 0;
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

  if v_attempt_id is not null then
    select *
    into v_attempt
    from public.orbit_paddle_checkout_attempts
    where id = v_attempt_id;

    v_attempt_found := found;
  end if;

  if v_attempt_found then
    v_user_id := v_attempt.user_id;
    v_purchase_type := v_attempt.purchase_type;
    v_item_key := v_attempt.item_key;
    v_requested_plan := v_attempt.requested_plan;
    v_requested_credits := v_attempt.requested_credits;
  end if;

  v_event_subscription_id := case
    when p_event_type = 'transaction.completed' then v_data ->> 'subscription_id'
    else v_data ->> 'id'
  end;

  if v_user_id is null and v_event_subscription_id is not null then
    select user_id, plan
    into v_user_id, v_requested_plan
    from public.orbit_billing_accounts
    where paddle_subscription_id = v_event_subscription_id;

    if found then
      v_purchase_type := 'subscription';
      v_item_key := 'subscription-renewal';
    end if;
  end if;

  if v_user_id is null then
    update public.orbit_paddle_webhook_events
    set status = 'ignored', processed_at = now()
    where event_id = p_event_id;

    return jsonb_build_object(
      'ignored', true,
      'reason', 'No Laboria Orbit checkout attempt or subscription match'
    );
  end if;

  insert into public.orbit_billing_accounts (user_id)
  values (v_user_id)
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
      v_event_transaction_id,
      v_user_id,
      case when v_attempt_found then v_attempt.id else null end,
      coalesce(v_item_key, 'subscription-renewal'),
      coalesce(v_purchase_type, 'subscription'),
      v_customer_id,
      v_event_subscription_id,
      v_data ->> 'currency_code',
      v_data -> 'details' -> 'totals' ->> 'total'
    )
    on conflict (paddle_transaction_id) do nothing;

    if v_attempt_found then
      update public.orbit_paddle_checkout_attempts
      set
        status = 'completed',
        paddle_transaction_id = v_event_transaction_id,
        paddle_subscription_id = v_event_subscription_id,
        completed_at = now()
      where id = v_attempt.id;
    end if;

    if v_purchase_type = 'credit_pack' then
      v_credit_result := public.grant_orbit_ai_credits(
        v_user_id,
        v_requested_credits,
        'Paddle AI credit pack purchase: ' || coalesce(v_item_key, 'credit-pack'),
        'paddle:' || v_event_transaction_id || ':' || coalesce(v_item_key, 'credit-pack'),
        v_event_transaction_id
      );

      v_credits_granted := coalesce((v_credit_result ->> 'creditsGranted')::integer, 0);
    elsif coalesce(v_purchase_type, 'subscription') = 'subscription' then
      v_plan := coalesce(v_requested_plan, (
        select plan from public.orbit_billing_accounts where user_id = v_user_id
      ));

      update public.orbit_billing_accounts
      set
        plan = case
          when v_plan in ('Orbit Plus', 'Orbit Pro') then v_plan
          else plan
        end,
        subscription_status = 'active',
        paddle_customer_id = coalesce(v_customer_id, paddle_customer_id),
        paddle_subscription_id = coalesce(v_event_subscription_id, paddle_subscription_id),
        updated_at = now()
      where user_id = v_user_id;

      v_period_key := coalesce(
        v_data -> 'billing_period' ->> 'ends_at',
        v_data -> 'billing_period' ->> 'starts_at',
        v_event_transaction_id
      );

      v_credit_result := public.grant_orbit_subscription_monthly_credits(
        v_user_id,
        v_plan,
        v_event_subscription_id,
        v_period_key,
        v_event_transaction_id
      );
    end if;
  elsif p_event_type in (
    'subscription.activated',
    'subscription.updated',
    'subscription.canceled'
  ) then
    v_plan := case
      when v_subscription_status = 'canceled' then 'Orbit Starter'
      else coalesce(v_requested_plan, (
        select plan from public.orbit_billing_accounts where user_id = v_user_id
      ))
    end;

    update public.orbit_billing_accounts
    set
      plan = case
        when v_plan in ('Orbit Starter', 'Orbit Plus', 'Orbit Pro') then v_plan
        else plan
      end,
      subscription_status = v_subscription_status,
      paddle_customer_id = coalesce(v_customer_id, paddle_customer_id),
      paddle_subscription_id = coalesce(v_event_subscription_id, paddle_subscription_id),
      current_period_ends_at = nullif(
        v_data -> 'current_billing_period' ->> 'ends_at',
        ''
      )::timestamptz,
      updated_at = now()
    where user_id = v_user_id;

    if v_attempt_found then
      update public.orbit_paddle_checkout_attempts
      set
        status = v_subscription_status,
        paddle_subscription_id = v_event_subscription_id
      where id = v_attempt.id;
    end if;

    if v_subscription_status <> 'canceled' then
      v_period_key := coalesce(
        v_data -> 'current_billing_period' ->> 'ends_at',
        v_data -> 'current_billing_period' ->> 'starts_at',
        p_event_id
      );

      v_credit_result := public.grant_orbit_subscription_monthly_credits(
        v_user_id,
        v_plan,
        v_event_subscription_id,
        v_period_key,
        null
      );
    end if;
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
    'creditResult', v_credit_result
  );
exception
  when others then
    update public.orbit_paddle_webhook_events
    set status = 'failed', last_error = sqlerrm
    where event_id = p_event_id;
    raise;
end;
$$;

revoke all on function public.get_orbit_included_monthly_credits(text)
from public, anon, authenticated;
revoke all on function public.grant_orbit_ai_credits(uuid, integer, text, text, text)
from public, anon, authenticated;
revoke all on function public.spend_orbit_ai_credits(uuid, integer, text, text)
from public, anon, authenticated;
revoke all on function public.grant_orbit_subscription_monthly_credits(uuid, text, text, text, text)
from public, anon, authenticated;
revoke all on function public.process_orbit_paddle_webhook(text, text, timestamptz, jsonb)
from public, anon, authenticated;

grant execute on function public.grant_orbit_ai_credits(uuid, integer, text, text, text)
to service_role;
grant execute on function public.spend_orbit_ai_credits(uuid, integer, text, text)
to service_role;
grant execute on function public.process_orbit_paddle_webhook(text, text, timestamptz, jsonb)
to service_role;
