import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createPaddleSupabaseAdminClient } from "@/app/lib/paddleBilling";

export const runtime = "nodejs";

type PaddleEvent = {
  event_id?: unknown;
  event_type?: unknown;
  occurred_at?: unknown;
  data?: unknown;
};

const webhookToleranceSeconds = 5;

const parsePaddleSignature = (header: string) => {
  const parts = header.split(";").map((part) => part.split("="));
  const timestamp = parts.find(([key]) => key === "ts")?.[1] || "";
  const signatures = parts
    .filter(([key, value]) => key === "h1" && Boolean(value))
    .map(([, value]) => value);

  return { timestamp, signatures };
};

const signaturesMatch = (
  rawBody: string,
  signatureHeader: string,
  secret: string,
) => {
  const { timestamp, signatures } = parsePaddleSignature(signatureHeader);
  const timestampNumber = Number(timestamp);

  if (
    !timestamp ||
    signatures.length === 0 ||
    !Number.isFinite(timestampNumber) ||
    Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) >
      webhookToleranceSeconds
  ) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}:${rawBody}`, "utf8")
    .digest();

  return signatures.some((signature) => {
    const actual = Buffer.from(signature, "hex");

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
};

export async function POST(request: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET?.trim();

  if (!secret) {
    console.error("[paddle-webhook] PADDLE_WEBHOOK_SECRET is missing");
    return NextResponse.json(
      { error: "Paddle webhook is not configured." },
      { status: 503 },
    );
  }

  const signatureHeader = request.headers.get("Paddle-Signature") || "";
  const rawBody = await request.text();

  if (!signaturesMatch(rawBody, signatureHeader, secret)) {
    console.warn("[paddle-webhook] signature verification failed");
    return NextResponse.json(
      { error: "Invalid Paddle webhook signature." },
      { status: 401 },
    );
  }

  let event: PaddleEvent;

  try {
    event = JSON.parse(rawBody) as PaddleEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  if (
    typeof event.event_id !== "string" ||
    typeof event.event_type !== "string" ||
    typeof event.occurred_at !== "string" ||
    !event.data ||
    typeof event.data !== "object"
  ) {
    return NextResponse.json({ error: "Invalid webhook event." }, { status: 400 });
  }

  const adminClient = createPaddleSupabaseAdminClient();

  if (!adminClient) {
    console.error("[paddle-webhook] SUPABASE_SERVICE_ROLE_KEY is missing");
    return NextResponse.json(
      { error: "Billing persistence is not configured." },
      { status: 503 },
    );
  }

  const { data, error } = await adminClient.rpc(
    "process_orbit_paddle_webhook",
    {
      p_event_id: event.event_id,
      p_event_type: event.event_type,
      p_occurred_at: event.occurred_at,
      p_payload: event,
    },
  );

  if (error) {
    console.error("[paddle-webhook] verified event processing failed", {
      eventId: event.event_id,
      eventType: event.event_type,
      error,
    });
    return NextResponse.json(
      { error: "Could not process verified Paddle webhook." },
      { status: 500 },
    );
  }

  console.info("[paddle-webhook] verified event processed", {
    eventId: event.event_id,
    eventType: event.event_type,
    result: data,
  });

  return NextResponse.json({ received: true, result: data });
}
