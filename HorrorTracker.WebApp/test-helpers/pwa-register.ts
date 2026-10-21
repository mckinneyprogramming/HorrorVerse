type RegisterOptions = {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onRegisteredSW?: (url: string, registration: { update: () => Promise<void> } | undefined) => void;
};

export function registerSW(options: RegisterOptions): (reloadPage?: boolean) => Promise<void> {
  options.onRegisteredSW?.("https://horrorverse.example/sw.js", {
    update: async () => undefined,
  });
  return async () => undefined;
}
