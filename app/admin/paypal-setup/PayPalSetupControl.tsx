"use client";

import { useState } from "react";

type SetupResult = {
  PAYPAL_PRODUCT_ID: string;
  PAYPAL_PLAN_ORBIT_PLUS: string;
  PAYPAL_PLAN_ORBIT_PRO: string;
};

export function PayPalSetupControl() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SetupResult | null>(null);
  const [error, setError] = useState("");

  const runSetup = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/setup-paypal-sandbox", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as
        | SetupResult
        | { error?: unknown };

      if (!response.ok) {
        const errorMessage =
          "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "PayPal Sandbox setup failed.";
        throw new Error(
          errorMessage,
        );
      }

      setResult(payload as SetupResult);
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : "PayPal Sandbox setup failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <pre className="mt-6 overflow-x-auto rounded-md bg-slate-950 p-4 text-sm leading-7 text-cyan-200">
        {`PAYPAL_PRODUCT_ID=${result.PAYPAL_PRODUCT_ID}
PAYPAL_PLAN_ORBIT_PLUS=${result.PAYPAL_PLAN_ORBIT_PLUS}
PAYPAL_PLAN_ORBIT_PRO=${result.PAYPAL_PLAN_ORBIT_PRO}`}
      </pre>
    );
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={loading}
        onClick={runSetup}
        className="w-full rounded-md bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 disabled:cursor-wait disabled:opacity-70"
      >
        {loading ? "Creating Sandbox plans..." : "Create or reuse Sandbox plans"}
      </button>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
