import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openAiCreate: vi.fn(),
  checkCredits: vi.fn(),
  spendCredits: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    responses = { create: mocks.openAiCreate };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}));

vi.mock("@/app/lib/orbitAiCreditsServer", () => ({
  checkOrbitAiCredits: mocks.checkCredits,
  spendOrbitAiCreditsAfterSuccess: mocks.spendCredits,
}));

import { POST } from "@/app/api/ai/toolbox-talk/route";

const request = (variant: "basic" | "quiz" = "basic") =>
  new Request("http://localhost/api/ai/toolbox-talk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      variant,
      sourceType: "manual_topic",
      inputs: {
        topic: "Electrical isolation",
        industrySector: "Manufacturing",
        department: "Maintenance",
        targetAudience: "Technicians",
        duration: "10 minutes",
        language: "English",
        riskLevel: "High",
        keyHazardsNotes: "Stored energy",
      },
    }),
  });

describe("Toolbox Talk server credit boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "sk-audit-placeholder";
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-audit" } },
    });
  });

  it("blocks OpenAI when the account lacks credits", async () => {
    mocks.checkCredits.mockResolvedValue({
      ok: false,
      status: 402,
      error: "Not enough AI credits.",
      account: { plan: "Orbit Starter", credits: 0 },
    });

    const response = await POST(request());

    expect(response.status).toBe(402);
    expect(mocks.openAiCreate).not.toHaveBeenCalled();
    expect(mocks.spendCredits).not.toHaveBeenCalled();
  });

  it("charges the quiz price only after valid OpenAI output", async () => {
    const adminClient = {};
    mocks.checkCredits.mockResolvedValue({
      ok: true,
      adminClient,
      account: { plan: "Orbit Plus", credits: 100 },
    });
    mocks.openAiCreate.mockResolvedValue({
      id: "resp_toolbox_audit",
      output_text: JSON.stringify({ title: "Electrical Isolation" }),
    });
    mocks.spendCredits.mockResolvedValue({
      ok: true,
      account: { plan: "Orbit Plus", credits: 95 },
    });

    const response = await POST(request("quiz"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.spendCredits).toHaveBeenCalledWith(
      adminClient,
      "user-audit",
      5,
      "ai-toolbox-talk:resp_toolbox_audit",
      "AI Toolbox Talk: quiz",
    );
    expect(payload.account.credits).toBe(95);
  });

  it("does not spend credits when OpenAI fails", async () => {
    mocks.checkCredits.mockResolvedValue({
      ok: true,
      adminClient: {},
      account: { plan: "Orbit Plus", credits: 100 },
    });
    mocks.openAiCreate.mockRejectedValue(new Error("audit failure"));

    const response = await POST(request());

    expect(response.status).toBe(502);
    expect(mocks.spendCredits).not.toHaveBeenCalled();
  });
});
