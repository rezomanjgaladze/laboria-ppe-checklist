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

During the pre-payment beta, an optional per-browser starter balance can be set
for signed-in users:

```bash
NEXT_PUBLIC_ORBIT_AI_DEFAULT_CREDITS=0
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

## Paddle Billing Staged Mode

Laboria Orbit includes a staged Paddle Billing integration. Checkout remains
disabled until every required variable is configured and the server billing
migration is applied. Client-side checkout success never grants a plan upgrade
or AI credits. Only verified Paddle webhooks can update billing records and the
AI credit ledger.

Create these recurring and one-time prices in Paddle sandbox:

- `Orbit Plus` subscription: `$19 / month`
- `Orbit Pro` subscription: `$49 / month`
- `Starter Top-Up`: `50 AI Credits` for `$7`
- `Orbit Plus Discount Pack`: `100 AI Credits` for `$8`
- `Orbit Pro Best Value Pack`: `100 AI Credits` for `$5`

Configure these Vercel environment variables:

```bash
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
PADDLE_ENVIRONMENT=sandbox
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
NEXT_PUBLIC_PADDLE_PRICE_ORBIT_PLUS=
NEXT_PUBLIC_PADDLE_PRICE_ORBIT_PRO=
NEXT_PUBLIC_PADDLE_PRICE_STARTER_TOPUP=
NEXT_PUBLIC_PADDLE_PRICE_PLUS_PACK=
NEXT_PUBLIC_PADDLE_PRICE_PRO_PACK=
SUPABASE_SERVICE_ROLE_KEY=
```

Apply the staged billing migration before enabling checkout:

```text
supabase/migrations/20260602_paddle_billing_staged.sql
```

Add this Paddle webhook destination:

```text
https://laboria-ppe-checklist.vercel.app/api/billing/paddle/webhook
```

Subscribe the destination to:

- `transaction.completed`
- `subscription.activated`
- `subscription.updated`
- `subscription.canceled`

## Production

Public production URL:

[https://laboria-ppe-checklist.vercel.app](https://laboria-ppe-checklist.vercel.app)
