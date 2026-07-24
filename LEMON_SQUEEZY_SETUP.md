# Lemon Squeezy Setup

Laboria Orbit uses Lemon Squeezy as its only billing provider. Complete these
steps before enabling customer checkout.

## 1. Apply the Supabase Migration

Run this file in the Supabase SQL Editor for the same project configured by
`NEXT_PUBLIC_SUPABASE_URL`:

```text
supabase/migrations/20260725_lemon_squeezy_billing.sql
```

The migration creates:

- `orbit_billing_accounts`
- `billing_customers`
- `billing_subscriptions`
- `billing_orders`
- `billing_events`
- `ai_credit_ledger`
- server-only credit grant and spend functions

## 2. Create Products and Variants

Create the following products or variants in Lemon Squeezy. Keep the displayed
prices and billing intervals exact.

| Environment key | Product | Billing | Price |
|---|---|---|---|
| `LEMONSQUEEZY_VARIANT_ORBIT_PLUS` | Orbit Plus | Monthly subscription | $19 |
| `LEMONSQUEEZY_VARIANT_ORBIT_PRO` | Orbit Pro | Monthly subscription | $49 |
| `LEMONSQUEEZY_VARIANT_STARTER_TOPUP` | Starter Top-Up, 50 AI Credits | One-time | $9 |
| `LEMONSQUEEZY_VARIANT_PLUS_PACK` | Orbit Plus, 100 AI Credits | One-time | $12 |
| `LEMONSQUEEZY_VARIANT_PRO_PACK` | Orbit Pro, 100 AI Credits | One-time | $8 |

Copy each numeric Variant ID, not the Product ID.

## 3. Configure Vercel

Add these values to the intended Vercel environments and redeploy:

```bash
LEMONSQUEEZY_API_KEY=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_WEBHOOK_SECRET=
LEMONSQUEEZY_VARIANT_ORBIT_PLUS=
LEMONSQUEEZY_VARIANT_ORBIT_PRO=
LEMONSQUEEZY_VARIANT_STARTER_TOPUP=
LEMONSQUEEZY_VARIANT_PLUS_PACK=
LEMONSQUEEZY_VARIANT_PRO_PACK=
NEXT_PUBLIC_BILLING_PROVIDER=lemon
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

The API key, webhook secret, and Supabase service-role key are server-only.

## 4. Register the Webhook

Use this production destination:

```text
https://laboria-ppe-checklist.vercel.app/api/billing/lemon/webhook
```

Subscribe it to:

- `order_created`
- `subscription_created`
- `subscription_updated`
- `subscription_cancelled`
- `subscription_expired`
- `subscription_resumed`
- `subscription_paused`
- `subscription_unpaused`
- `subscription_payment_success`
- `subscription_payment_failed`

Copy the webhook signing secret to `LEMONSQUEEZY_WEBHOOK_SECRET`.

## 5. Test Before Going Live

Use Lemon Squeezy test mode first. Verify:

1. Plus and Pro checkout URLs open.
2. One-time credit packs grant the correct amount once.
3. Subscription creation applies the correct plan and initial credits.
4. A renewal grants the monthly credits once.
5. Replaying a webhook does not grant duplicate credits.
6. Cancellation retains access through `ends_at`.
7. Expiration returns the account to Orbit Starter.
8. Paused, past-due, or unpaid states show their warning status without
   silently changing the paid plan.
9. Customer portal and payment-method links appear in Billing settings.
