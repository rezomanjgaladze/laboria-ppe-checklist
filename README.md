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
```

During the pre-payment beta, an optional per-browser starter balance can be set
for signed-in users:

```bash
NEXT_PUBLIC_ORBIT_AI_DEFAULT_CREDITS=0
```

The AI Toolbox Talk Generator uses `OPENAI_API_KEY` only from its authenticated
server route. AI credits are deducted after a successful generation.

## Production

Public production URL:

[https://laboria-ppe-checklist.vercel.app](https://laboria-ppe-checklist.vercel.app)
