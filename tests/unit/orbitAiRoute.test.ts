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

import { POST } from "@/app/api/ai/orbit/route";

const request = () =>
  new Request("http://localhost/api/ai/orbit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      toolId: "corrective-actions",
      toolTitle: "AI Recommend Corrective Actions",
      toolDescription: "Suggest actions",
      sourceModule: "Action Tracker",
      sourceMode: "manual",
      inputs: { focus: "Guarding defect" },
    }),
  });

describe("Orbit AI server credit boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "sk-audit-placeholder";
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-audit" } },
    });
  });

  it("blocks generation before OpenAI when credits are insufficient", async () => {
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

  it("spends credits server-side before releasing successful output", async () => {
    const adminClient = { rpc: vi.fn() };
    mocks.checkCredits.mockResolvedValue({
      ok: true,
      adminClient,
      account: { plan: "Orbit Plus", credits: 100 },
    });
    mocks.openAiCreate.mockResolvedValue({
      id: "resp_audit",
      output_text: JSON.stringify({ title: "Corrective Actions" }),
    });
    mocks.spendCredits.mockResolvedValue({
      ok: true,
      account: { plan: "Orbit Plus", credits: 96 },
    });

    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.spendCredits).toHaveBeenCalledWith(
      adminClient,
      "user-audit",
      4,
      "ai-generation:resp_audit",
      "Orbit AI: corrective-actions",
    );
    expect(payload.account).toEqual({ plan: "Orbit Plus", credits: 96 });
    expect(payload.content).toEqual({ title: "Corrective Actions" });
  });

  it("does not spend credits when OpenAI generation fails", async () => {
    mocks.checkCredits.mockResolvedValue({
      ok: true,
      adminClient: {},
      account: { plan: "Orbit Plus", credits: 100 },
    });
    mocks.openAiCreate.mockRejectedValue(new Error("audit OpenAI failure"));

    const response = await POST(request());

    expect(response.status).toBe(502);
    expect(mocks.spendCredits).not.toHaveBeenCalled();
  });
});
