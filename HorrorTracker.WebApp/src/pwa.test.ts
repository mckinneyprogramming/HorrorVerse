// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  hooks: null as null | {
    immediate?: boolean;
    onNeedRefresh: () => void;
    onRegisteredSW: (url: string, registration: { update: () => Promise<void> } | undefined) => void;
  },
  apply: vi.fn(async (_reload?: boolean) => undefined),
}));

vi.mock("virtual:pwa-register", () => ({
  registerSW: (options: NonNullable<typeof state.hooks>) => {
    state.hooks = options;
    state.apply = vi.fn(async () => undefined);
    return state.apply;
  },
}));

function setVisibility(value: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
}

function setNavigator(userAgent: string, platform: string, maxTouchPoints: number): void {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: userAgent });
  Object.defineProperty(navigator, "platform", { configurable: true, value: platform });
  Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: maxTouchPoints });
}

function installEvent(outcome: "accepted" | "dismissed"): Event {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(event, {
    prompt: vi.fn(async () => undefined),
    userChoice: Promise.resolve({ outcome }),
  });
  return event;
}

async function load(register = true) {
  vi.resetModules();
  const pwa = await import("./pwa");
  if (register) {
    pwa.registerPwa();
  }

  return pwa;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registerPwa", () => {
  it("stores the install prompt and reports the choice", async () => {
    const pwa = await load();
    const listener = vi.fn();
    const stop = pwa.onInstallAvailabilityChange(listener);
    expect(state.hooks?.immediate).toBe(true);
    expect(pwa.canPromptInstall()).toBe(false);
    await expect(pwa.promptInstall()).resolves.toBe(false);

    const dismissed = installEvent("dismissed");
    const prevent = vi.spyOn(dismissed, "preventDefault");
    window.dispatchEvent(dismissed);
    expect(prevent).toHaveBeenCalled();
    expect(pwa.canPromptInstall()).toBe(true);
    expect(listener).toHaveBeenCalled();
    await expect(pwa.promptInstall()).resolves.toBe(false);
    expect(pwa.canPromptInstall()).toBe(false);

    window.dispatchEvent(installEvent("accepted"));
    await expect(pwa.promptInstall()).resolves.toBe(true);
    expect(pwa.canPromptInstall()).toBe(false);

    window.dispatchEvent(installEvent("accepted"));
    expect(pwa.canPromptInstall()).toBe(true);
    window.dispatchEvent(new Event("appinstalled"));
    expect(pwa.canPromptInstall()).toBe(false);

    stop();
    listener.mockClear();
    window.dispatchEvent(installEvent("accepted"));
    expect(listener).not.toHaveBeenCalled();
  });

  it("checks for updates on visible and restored pages", async () => {
    const pwa = await load();
    const update = vi.fn(async () => undefined);
    const listener = vi.fn();
    pwa.onInstallAvailabilityChange(listener);
    const hooks = state.hooks;
    if (!hooks) {
      throw new Error("registerSW was not called");
    }

    hooks.onRegisteredSW("https://horrorverse.example/sw.js", undefined);
    hooks.onRegisteredSW("https://horrorverse.example/sw.js", { update });

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(update).not.toHaveBeenCalled();

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(update).toHaveBeenCalledTimes(1);
    expect(listener).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("pageshow"));
    const fresh = new Event("pageshow");
    Object.defineProperty(fresh, "persisted", { value: false });
    window.dispatchEvent(fresh);
    expect(update).toHaveBeenCalledTimes(1);

    const restored = new Event("pageshow");
    Object.defineProperty(restored, "persisted", { value: true });
    window.dispatchEvent(restored);
    expect(update).toHaveBeenCalledTimes(2);

    hooks.onNeedRefresh();
    expect(pwa.canPromptUpdate()).toBe(true);
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(restored);
    expect(listener).toHaveBeenCalledTimes(4);

    await pwa.applyPendingUpdate();
    expect(state.apply).toHaveBeenCalledWith(true);
    expect(pwa.canPromptUpdate()).toBe(false);

    hooks.onNeedRefresh();
    pwa.dismissPendingUpdate();
    expect(pwa.canPromptUpdate()).toBe(false);
  });

  it("applies an update only after registration", async () => {
    const pwa = await load(false);
    await pwa.applyPendingUpdate();
    expect(pwa.canPromptUpdate()).toBe(false);
    pwa.dismissPendingUpdate();
    expect(state.apply).not.toHaveBeenCalled();
  });

  it("detects standalone display and iOS devices", async () => {
    const pwa = await load(false);
    let standaloneMatches = false;
    window.matchMedia = (query: string) =>
      ({
        matches: standaloneMatches && query === "(display-mode: standalone)",
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList;

    standaloneMatches = true;
    expect(pwa.isStandalone()).toBe(true);

    standaloneMatches = false;
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
    expect(pwa.isStandalone()).toBe(true);
    Object.defineProperty(navigator, "standalone", { configurable: true, value: false });
    expect(pwa.isStandalone()).toBe(false);
    Object.defineProperty(navigator, "standalone", { configurable: true, value: undefined });
    expect(pwa.isStandalone()).toBe(false);

    setNavigator("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "iPhone", 0);
    expect(pwa.isIosDevice()).toBe(true);
    setNavigator("Mozilla/5.0 (iPad)", "iPad", 0);
    expect(pwa.isIosDevice()).toBe(true);
    setNavigator("Mozilla/5.0 (iPod touch)", "iPod", 0);
    expect(pwa.isIosDevice()).toBe(true);
    setNavigator("Mozilla/5.0", "MacIntel", 2);
    expect(pwa.isIosDevice()).toBe(true);
    setNavigator("Mozilla/5.0", "MacIntel", 1);
    expect(pwa.isIosDevice()).toBe(false);
    setNavigator("Mozilla/5.0", "MacIntel", 0);
    expect(pwa.isIosDevice()).toBe(false);
    setNavigator("Mozilla/5.0", "Win32", 5);
    expect(pwa.isIosDevice()).toBe(false);
  });
});
