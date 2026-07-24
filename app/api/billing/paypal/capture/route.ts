import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createBillingSupabaseAdminClient } from "@/app/lib/billingServer";
import {
  getSafePayPalApiError,
  requestPayPalApi,
} from "@/app/lib/paypalBilling";
import { processPayPalCreditPackCapture } from "@/app/lib/paypalBillingPersistence";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Capture = {
  id?: unknown;
  status?: unknown;
};

type PayPalOrderPayload = {
  id?: unknown;
  status?: unknown;
  purchase_units?: unknown;
};

const paypalIdPattern = /^[A-Z0-9-]{3,64}$/i;

const getCompletedCapture = (payload: PayPalOrderPayload | null) => {
  const purchaseUnits = Array.isArray(payload?.purchase_units)
    ? payload.purchase_units
    : [];

  for (const purchaseUnit of purchaseUnits) {
    if (!purchaseUnit || typeof purchaseUnit !== "object") continue;
    const payments = (purchaseUnit as { payments?: unknown }).payments;
    if (!payments || typeof payments !== "object") continue;
    const captures = Array.isArray(
      (payments as { captures?: unknown }).captures,
    )
      ? ((payments as { captures: unknown[] }).captures as Capture[])
      : [];
    const completed = captures.find(
      (capture) =>
        capture.status === "COMPLETED" && typeof capture.id === "string",
    );
    if (completed && typeof completed.id === "string") return completed.id;
  }

  return "";
};

const redirectToBillingResult = (
  request: Request,
  result: "success" | "pending" | "error",
  message?: string,
) => {
  const url = new URL("/", request.url);
  url.searchParams.set("billing", result);
  if (message) url.searchParams.set("billing_message", message.slice(0, 180));
  return NextResponse.redirect(url);
};

const handleCapture = async (
  request: Request,
  orderId: string,
  redirect: boolean,
) => {
  if (!paypalIdPattern.test(orderId)) {
    const message = "PayPal returned an invalid order reference.";
    return redirect
      ? redirectToBillingResult(request, "error", message)
      : NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const message = "Authentication required to complete PayPal checkout.";
    return redirect
      ? redirectToBillingResult(request, "error", message)
      : NextResponse.json({ error: message }, { status: 401 });
  }

  const adminClient = createBillingSupabaseAdminClient();
  if (!adminClient) {
    const message = "Billing persistence is not configured.";
    return redirect
      ? redirectToBillingResult(request, "error", message)
      : NextResponse.json({ error: message }, { status: 503 });
  }

  const { data: order, error: orderError } = await adminClient
    .from("billing_orders")
    .select("user_id, status, paypal_capture_id, credits_granted")
    .eq("paypal_order_id", orderId)
    .maybeSingle();

  if (orderError || !order || order.user_id !== user.id) {
    const message = "PayPal order is not linked to this Orbit account.";
    return redirect
      ? redirectToBillingResult(request, "error", message)
      : NextResponse.json({ error: message }, { status: 404 });
  }

  if (
    order.status === "completed" &&
    typeof order.paypal_capture_id === "string" &&
    order.paypal_capture_id
  ) {
    return redirect
      ? redirectToBillingResult(request, "success")
      : NextResponse.json({
          captured: true,
          duplicate: true,
          creditsGranted: order.credits_granted || 0,
        });
  }

  try {
    let { response, payload } = await requestPayPalApi<PayPalOrderPayload>(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      { method: "POST", body: "{}" },
      randomUUID(),
    );
    let captureId = getCompletedCapture(payload);

    if (!response.ok && response.status === 422) {
      const existing = await requestPayPalApi<PayPalOrderPayload>(
        `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
        { method: "GET" },
      );
      response = existing.response;
      payload = existing.payload;
      captureId = getCompletedCapture(payload);
    }

    if (!response.ok || !captureId) {
      const pending = payload?.status === "PAYER_ACTION_REQUIRED";
      const error = getSafePayPalApiError(
        payload,
        pending
          ? "PayPal payment still requires buyer approval."
          : "PayPal payment could not be captured.",
      );
      console.error("[paypal-capture] capture failed", {
        userId: user.id,
        orderId,
        responseStatus: response.status,
        orderStatus:
          typeof payload?.status === "string" ? payload.status : null,
        error,
      });
      return redirect
        ? redirectToBillingResult(
            request,
            pending ? "pending" : "error",
            error,
          )
        : NextResponse.json(
            { error, pending },
            { status: pending ? 409 : 502 },
          );
    }

    const result = await processPayPalCreditPackCapture({
      adminClient,
      orderId,
      captureId,
    });

    console.info("[paypal-capture] order captured", {
      userId: user.id,
      orderId,
      captureId,
      productType: result.productType,
      duplicate: result.duplicate,
    });
    return redirect
      ? redirectToBillingResult(request, "success")
      : NextResponse.json({
          captured: true,
          creditsGranted: result.creditsGranted,
          duplicate: result.duplicate,
        });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "PayPal payment could not be completed.";
    console.error("[paypal-capture] capture processing failed", {
      userId: user.id,
      orderId,
      error: message,
    });
    return redirect
      ? redirectToBillingResult(request, "error", message)
      : NextResponse.json({ error: message }, { status: 500 });
  }
};

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("token") || "";
  return handleCapture(request, orderId, true);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    order_id?: unknown;
  } | null;
  const orderId =
    typeof body?.order_id === "string" ? body.order_id.trim() : "";
  return handleCapture(request, orderId, false);
}
