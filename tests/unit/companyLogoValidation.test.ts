import { describe, expect, it } from "vitest";
import { isAllowedCompanyLogoSignature } from "@/app/api/workspace/company-logo/route";

describe("company logo content validation", () => {
  it("accepts valid PNG, JPEG, and WEBP signatures", () => {
    expect(
      isAllowedCompanyLogoSignature(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png",
      ),
    ).toBe(true);
    expect(
      isAllowedCompanyLogoSignature(
        new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        "image/jpeg",
      ),
    ).toBe(true);
    expect(
      isAllowedCompanyLogoSignature(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
        ]),
        "image/webp",
      ),
    ).toBe(true);
  });

  it("rejects HTML or arbitrary bytes mislabeled as an image", () => {
    const html = new TextEncoder().encode("<script>alert(1)</script>");
    expect(isAllowedCompanyLogoSignature(html, "image/png")).toBe(false);
    expect(isAllowedCompanyLogoSignature(html, "image/jpeg")).toBe(false);
    expect(isAllowedCompanyLogoSignature(html, "image/webp")).toBe(false);
  });
});
