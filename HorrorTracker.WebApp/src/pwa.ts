import { registerSW } from "virtual:pwa-register";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let updateReady = false;
let showUpdatePrompt = false;
let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;
const listeners = new Set<() => void>();

export function registerPwa(): void {
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true;
      showUpdatePrompt = true;
      notify();
    },
    onRegisteredSW(_url, registration) {
      const checkForUpdate = () => {
        void registration?.update();
      };

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") {
          return;
        }

        checkForUpdate();
        if (updateReady) {
          showUpdatePrompt = true;
          notify();
        }
      });

      window.addEventListener("pageshow", (event) => {
        if (!event.persisted) {
          return;
        }

        checkForUpdate();
        if (updateReady) {
          showUpdatePrompt = true;
          notify();
        }
      });
    },
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) {
    return false;
  }

  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return outcome === "accepted";
}

export function canPromptUpdate(): boolean {
  return showUpdatePrompt;
}

export async function applyPendingUpdate(): Promise<void> {
  showUpdatePrompt = false;
  notify();
  await applyUpdate?.(true);
}

export function dismissPendingUpdate(): void {
  showUpdatePrompt = false;
  notify();
}

export function onInstallAvailabilityChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function isIosDevice(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function notify(): void {
  listeners.forEach((listener) => listener());
}
