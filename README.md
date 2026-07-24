# Laboria Orbit

AI-powered health and safety workspace for modern workplaces.

Connect inspections, risk assessments, actions, training, incidents, and analytics
in one intelligent safety workspace.

## Development

Run the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment

Configure Supabase authentication and the server-only OpenAI key:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
OPENAI_API_KEY=
# Optional override. Defaults to the current cost-efficient toolbox talk model.
OPENAI_MODEL=gpt-5.4-mini
# Optional. Allows the company-logo API to create the private bucket automatically.
SUPABASE_SERVICE_ROLE_KEY=
```

The AI Toolbox Talk Generator uses `OPENAI_API_KEY` only from its authenticated
server route. AI credits are deducted after a successful generation.

## Company Logo Storage

Company logos are stored in the private Supabase Storage bucket `company-logos`.
Apply the included migration before enabling uploads:

```text
supabase/migrations/20260602_company_logos_storage.sql
```

The storage policies limit each authenticated user to their own folder. When
`SUPABASE_SERVICE_ROLE_KEY` is configured on the server, the upload route can
also create the private bucket automatically.

## Lemon Squeezy Billing

Laboria Orbit uses Lemon Squeezy for subscriptions and AI credit packs.
Checkout remains unavailable until every required variable is configured and
the server billing migration is applied. Browser checkout success never grants
a plan upgrade or AI credits. Only verified webhook events update billing
records and the AI credit ledger.

The approved Orbit package structure, operational limits, AI entitlements,
credit packs, and billing product catalog live in one source file:

```text
app/lib/orbitPlans.ts
```

Create these recurring and one-time variants in Lemon Squeezy:

- `Orbit Plus` subscription: `$19 / month`
- `Orbit Pro` subscription: `$49 / month`
- `Starter Top-Up`: `50 AI Credits` for `$9`
- `Orbit Plus Discount Pack`: `100 AI Credits` for `$12`
- `Orbit Pro Best Value Pack`: `100 AI Credits` for `$8`

Configure these Vercel environment variables:

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
SUPABASE_SERVICE_ROLE_KEY=
```

Apply the billing migration before enabling checkout:

```text
supabase/migrations/20260725_lemon_squeezy_billing.sql
```

Add this Lemon Squeezy webhook destination:

```text
https://laboria-ppe-checklist.vercel.app/api/billing/lemon/webhook
```

Subscribe the destination to:

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

## Production

Public production URL:

[https://laboria-ppe-checklist.vercel.app](https://laboria-ppe-checklist.vercel.app)
