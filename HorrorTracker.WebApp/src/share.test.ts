// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { shareStoryImage } from "./share";

function fileBlob(type = "image/png"): Blob {
  return new Blob(["story"], { type });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("shareStoryImage", () => {
  it("shares a file when the browser accepts it", async () => {
    const share = vi.fn(async () => undefined);
    const canShare = vi.fn(() => true);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: canShare });
    const create = vi.spyOn(URL, "createObjectURL");

    await expect(shareStoryImage(fileBlob(), "horrorverse-scream.png")).resolves.toBe("shared");
    expect(canShare).toHaveBeenCalled();
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ title: "HorrorVerse", text: "From the HorrorVerse" }),
    );
    const shared = share.mock.calls[0][0] as { files: File[] };
    expect(shared.files[0]?.name).toBe("horrorverse-scream.png");
    expect(shared.files[0]?.type).toBe("image/png");
    expect(create).not.toHaveBeenCalled();
  });

  it("treats a cancelled share sheet as shared", async () => {
    const abort = new Error("cancelled");
    abort.name = "AbortError";
    Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn(async () => { throw abort; }) });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    const create = vi.spyOn(URL, "createObjectURL");

    await expect(shareStoryImage(fileBlob(""), "story.png")).resolves.toBe("shared");
    expect(create).not.toHaveBeenCalled();

    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn(async () => {
        throw { name: "AbortError" };
      }),
    });
    await expect(shareStoryImage(fileBlob(), "story.png")).resolves.toBe("shared");
  });

  it("downloads when sharing fails for another reason", async () => {
    vi.useFakeTimers();
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:story");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: vi.fn(async () => {
        throw new Error("unsupported");
      }),
    });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });

    await expect(shareStoryImage(fileBlob(), "horrorverse-scream.png")).resolves.toBe("saved");
    expect(click).toHaveBeenCalled();
    expect(create).toHaveBeenCalled();
    expect(document.querySelector("a")).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith("blob:story");

    for (const error of [null, "nope", {}, { name: "NotAllowedError" }]) {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: vi.fn(async () => {
          throw error;
        }),
      });
      await expect(shareStoryImage(fileBlob(), "again.png")).resolves.toBe("saved");
    }
  });

  it("downloads when the browser cannot share files", async () => {
    vi.useFakeTimers();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:plain");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
    await expect(shareStoryImage(fileBlob(), "plain.png")).resolves.toBe("saved");

    Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn() });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
    await expect(shareStoryImage(fileBlob(), "plain.png")).resolves.toBe("saved");

    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
    await expect(shareStoryImage(fileBlob(), "plain.png")).resolves.toBe("saved");
    expect(click).toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
  });
});
