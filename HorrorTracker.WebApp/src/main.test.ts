// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mountApp = vi.hoisted(() => vi.fn());
const registerPwa = vi.hoisted(() => vi.fn());

vi.mock("./app", () => ({ mountApp }));
vi.mock("./pwa", () => ({ registerPwa }));
vi.mock("./styles.css", () => ({}));

describe("main", () => {
  beforeEach(() => {
    vi.resetModules();
    mountApp.mockClear();
    registerPwa.mockClear();
    document.body.innerHTML = "";
  });

  it("throws when the app root is missing", async () => {
    await expect(import("./main")).rejects.toThrow("HorrorVerse root element was not found.");
    expect(registerPwa).toHaveBeenCalledOnce();
    expect(mountApp).not.toHaveBeenCalled();
  });

  it("mounts into #app", async () => {
    document.body.innerHTML = '<main id="app"></main>';
    await import("./main");
    expect(registerPwa).toHaveBeenCalledOnce();
    expect(mountApp).toHaveBeenCalledTimes(1);
    expect(mountApp).toHaveBeenCalledWith(document.getElementById("app"));
  });
});
