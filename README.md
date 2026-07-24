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

## PayPal Billing

Laboria Orbit uses direct PayPal REST APIs for subscriptions and AI credit
packs. Checkout remains unavailable until the required PayPal variables are
configured and the server billing migration is applied. Browser approval alone
never grants a plan upgrade or AI credits. Entitlements are applied only after
server-side capture or verified PayPal webhook events.

The approved Orbit package structure, operational limits, AI entitlements,
credit packs, and billing product catalog live in one source file:

```text
app/lib/orbitPlans.ts
```

Create these PayPal subscription plans:

- `Orbit Plus` subscription: `$19 / month`
- `Orbit Pro` subscription: `$49 / month`

One-time credit packs use the PayPal Orders API:

- `Starter Top-Up`: `50 AI Credits` for `$9`
- `Orbit Plus Discount Pack`: `100 AI Credits` for `$12`
- `Orbit Pro Best Value Pack`: `100 AI Credits` for `$8`

Configure these Vercel environment variables:

```bash
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_PLAN_ORBIT_PLUS=
PAYPAL_PLAN_ORBIT_PRO=
NEXT_PUBLIC_BILLING_PROVIDER=paypal
SUPABASE_SERVICE_ROLE_KEY=
```

Apply the billing migration before enabling checkout:

```text
supabase/migrations/20260726_paypal_billing.sql
```

Add this PayPal webhook destination:

```text
https://laboria-ppe-checklist.vercel.app/api/billing/paypal/webhook
```

Subscribe the destination to:

- `BILLING.SUBSCRIPTION.CREATED`
- `BILLING.SUBSCRIPTION.ACTIVATED`
- `BILLING.SUBSCRIPTION.UPDATED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.SUSPENDED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
- `PAYMENT.SALE.COMPLETED`
- `PAYMENT.CAPTURE.COMPLETED`

See [PAYPAL_SETUP.md](PAYPAL_SETUP.md) for complete Sandbox setup and testing
steps.

## Production

Public production URL:

[https://laboria-ppe-checklist.vercel.app](https://laboria-ppe-checklist.vercel.app)
