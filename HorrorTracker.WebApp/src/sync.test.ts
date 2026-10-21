import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importHorrorVault, syncVault } from "./sync";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("offline");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("syncVault", () => {
  it("syncs the whole vault or one title", async () => {
    const fetchMock = vi.fn(async () => json({ added: 3, postersFilled: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(syncVault()).resolves.toEqual({ added: 3, postersFilled: 1 });
    await expect(syncVault("movie:12")).resolves.toEqual({ added: 3, postersFilled: 1 });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/sync");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/sync?id=movie%3A12");
  });

  it("treats missing counts as zero", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ added: "nope", postersFilled: null })));
    await expect(syncVault()).resolves.toEqual({ added: 0, postersFilled: 0 });

    vi.stubGlobal("fetch", vi.fn(async () => json({})));
    await expect(syncVault("show:1")).resolves.toEqual({ added: 0, postersFilled: 0 });
  });

  it("raises server errors and survives a bad body or a dropped network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Busy" }, 503)));
    await expect(syncVault()).rejects.toThrow("Busy");

    vi.stubGlobal("fetch", vi.fn(async () => json({ nope: true }, 500)));
    await expect(syncVault()).rejects.toThrow("Vault sync failed (500)");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 502 })));
    await expect(syncVault()).rejects.toThrow("Vault sync failed (502)");

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(syncVault()).rejects.toThrow("offline");
  });
});

describe("importHorrorVault", () => {
  it("normalizes a collections batch", async () => {
    const fetchMock = vi.fn(async () =>
      json({
        import: "horror-collections",
        done: true,
        added: 2,
        skipped: 3,
        batchAdded: 1,
        batchSkipped: 4,
        queued: 5,
        label: "  Batch  ",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(importHorrorVault("horror-collections")).resolves.toEqual({
      import: "horror-collections",
      done: true,
      added: 2,
      skipped: 3,
      batchAdded: 1,
      batchSkipped: 4,
      queued: 5,
      label: "Batch",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sync",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ import: "horror-collections" }) }),
    );
  });

  it("falls back when the batch payload is sparse", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          import: "other",
          done: 0,
          added: "nope",
          skipped: null,
          batchAdded: Number.POSITIVE_INFINITY,
          batchSkipped: "",
          queued: undefined,
          label: 12,
        }),
      ),
    );
    await expect(importHorrorVault("horror-films")).resolves.toEqual({
      import: "horror-films",
      done: false,
      added: 0,
      skipped: 0,
      batchAdded: 0,
      batchSkipped: 0,
      queued: 0,
      label: "12",
    });

    vi.stubGlobal("fetch", vi.fn(async () => json({})));
    await expect(importHorrorVault("horror-films")).resolves.toMatchObject({ import: "horror-films", label: "", done: false });
  });

  it("raises server errors and survives a bad body or a dropped network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "Stopped" }, 409)));
    await expect(importHorrorVault("horror-films")).rejects.toThrow("Stopped");

    vi.stubGlobal("fetch", vi.fn(async () => json({}, 500)));
    await expect(importHorrorVault("horror-films")).rejects.toThrow("Horror import failed (500)");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(importHorrorVault("horror-collections")).rejects.toThrow("Horror import failed (500)");

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    await expect(importHorrorVault("horror-films")).rejects.toThrow("offline");
  });
});
