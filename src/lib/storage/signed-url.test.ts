import { describe, expect, it, vi } from "vitest";

const createSignedUrl = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { storage: { from: () => ({ createSignedUrl }) } },
}));

import { signedObjectUrl, toObjectPath } from "./signed-url";

describe("toObjectPath (H-19)", () => {
  it("keeps a plain object path", () => {
    expect(toObjectPath("documents", "coe/COE-2026-000001.pdf")).toBe(
      "coe/COE-2026-000001.pdf",
    );
  });

  it("extracts the path from a legacy public URL", () => {
    expect(
      toObjectPath(
        "documents",
        "https://x.supabase.co/storage/v1/object/public/documents/coe/a%20b.pdf",
      ),
    ).toBe("coe/a b.pdf");
  });

  it("extracts the path from an expired signed URL", () => {
    expect(
      toObjectPath(
        "certificates",
        "https://x.supabase.co/storage/v1/object/sign/certificates/ct/1.pdf?token=abc",
      ),
    ).toBe("ct/1.pdf");
  });
});

describe("signedObjectUrl", () => {
  it("returns null for empty input without calling storage", async () => {
    expect(await signedObjectUrl("documents", null)).toBeNull();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("signs the normalised path", async () => {
    createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: "https://signed" },
      error: null,
    });
    expect(
      await signedObjectUrl(
        "documents",
        "https://x.supabase.co/storage/v1/object/public/documents/pds/p.pdf",
      ),
    ).toBe("https://signed");
    expect(createSignedUrl).toHaveBeenCalledWith("pds/p.pdf", 600);
  });

  it("returns null when signing fails", async () => {
    createSignedUrl.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" },
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await signedObjectUrl("documents", "x.pdf")).toBeNull();
  });
});
