# PayPal Setup

Laboria Orbit uses direct PayPal REST APIs as its only billing provider. Keep
the integration in Sandbox until every checkout, webhook, entitlement, and
credit-ledger test passes.

## 1. Apply the Supabase Migration

Run this file in the Supabase SQL Editor for the same project configured by
`NEXT_PUBLIC_SUPABASE_URL`:

```text
supabase/migrations/20260726_paypal_billing.sql
```

The migration creates or upgrades:

- `orbit_billing_accounts`
- `billing_customers`
- `billing_subscriptions`
- `billing_orders`
- `billing_events`
- `ai_credit_ledger`
- server-only credit grant and spend functions

It does not delete historical billing rows. New production writes use
`provider = paypal`.

## 2. Create a PayPal Developer App

1. Sign in to the PayPal Developer Dashboard.
2. Open **Apps & Credentials**.
3. Select **Sandbox**.
4. Create a REST app named `Laboria Orbit`.
5. Copy its Sandbox **Client ID** and **Client Secret**.
6. Keep the Client Secret server-side. Never use it in browser code or in a
   `NEXT_PUBLIC_` variable.

## 3. Create the Product and Subscription Plans

Use the Sandbox credentials to request an OAuth access token from:

```text
POST https://api-m.sandbox.paypal.com/v1/oauth2/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(PAYPAL_CLIENT_ID:PAYPAL_CLIENT_SECRET)

grant_type=client_credentials
```

Create the product:

```text
POST https://api-m.sandbox.paypal.com/v1/catalogs/products
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{
  "name": "Laboria Orbit",
  "description": "AI-powered health and safety workspace",
  "type": "SERVICE",
  "category": "SOFTWARE"
}
```

Copy the returned product ID. Create the Plus plan with:

```json
{
  "product_id": "PAYPAL_PRODUCT_ID",
  "name": "Orbit Plus",
  "status": "ACTIVE",
  "billing_cycles": [
    {
      "frequency": { "interval_unit": "MONTH", "interval_count": 1 },
      "tenure_type": "REGULAR",
      "sequence": 1,
      "total_cycles": 0,
      "pricing_scheme": {
        "fixed_price": { "value": "19.00", "currency_code": "USD" }
      }
    }
  ],
  "payment_preferences": {
    "auto_bill_outstanding": true,
    "setup_fee": { "value": "0", "currency_code": "USD" },
    "setup_fee_failure_action": "CONTINUE",
    "payment_failure_threshold": 1
  }
}
```

Send that JSON to:

```text
POST https://api-m.sandbox.paypal.com/v1/billing/plans
```

Create Orbit Pro through the same endpoint using the name `Orbit Pro` and
fixed price `49.00`. Both plans must use the same PayPal product so PayPal can
revise an existing subscription between Plus and Pro. Copy the returned plan
IDs, which begin with `P-`.

Set:

```bash
PAYPAL_PLAN_ORBIT_PLUS=P-...
PAYPAL_PLAN_ORBIT_PRO=P-...
```

The one-time AI credit packs do not need PayPal plan IDs. Laboria Orbit creates
Orders API payments directly for:

- Starter Top-Up: 50 credits for `$9`
- Orbit Plus Pack: 100 credits for `$12`
- Orbit Pro Pack: 100 credits for `$8`

## 4. Register the Webhook

Preferred production URL:

```text
https://orbit.laboriaglobal.com/api/billing/paypal/webhook
```

Temporary Vercel production URL:

```text
https://laboria-ppe-checklist.vercel.app/api/billing/paypal/webhook
```

Register the webhook on the same Sandbox REST app used for checkout. Subscribe
to:

- `BILLING.SUBSCRIPTION.CREATED`
- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.UPDATED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
- `PAYMENT.SALE.COMPLETED`
- `PAYMENT.SALE.REFUNDED`
- `PAYMENT.SALE.REVERSED`
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.REVERSED`

Copy the webhook ID into `PAYPAL_WEBHOOK_ID`. This is the webhook ID, not a
secret or event ID.

## 5. Configure Vercel

Add these variables to Production and Preview as appropriate:

```bash
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_PLAN_ORBIT_PLUS=
PAYPAL_PLAN_ORBIT_PRO=
NEXT_PUBLIC_BILLING_PROVIDER=paypal

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_SITE_URL=https://orbit.laboriaglobal.com
```

For the temporary Vercel hostname, set:

```bash
NEXT_PUBLIC_SITE_URL=https://laboria-ppe-checklist.vercel.app
```

Redeploy after changing environment variables.

## 6. Sandbox Test Checklist

1. Sign in with a safe Laboria Orbit test account.
2. Confirm `/api/billing/paypal/config` reports PayPal Sandbox ready.
3. Open Orbit Plus checkout and approve it with a PayPal Sandbox buyer.
4. Confirm the verified activation and payment webhooks update the plan.
5. Confirm Plus grants 100 credits once for each successful payment.
6. Repeat with Orbit Pro and confirm 300 monthly credits.
7. Purchase each eligible AI credit pack.
8. Confirm the server capture route completes the order.
9. Replay the same capture and webhook; the balance must not increase twice.
10. Cancel a subscription and verify its status and access-end behavior.
11. Exercise suspended, failed-payment, expired, refunded, and reversed events.
12. Confirm normal users cannot read another user's billing rows.

Do not switch `PAYPAL_MODE` to `live` until Sandbox checkout, signature
verification, idempotency, plan access, cancellation, and failure handling have
all been verified.
