export type HorrorImportKind = "horror-films" | "horror-collections";

export interface HorrorImportProgress {
  import: HorrorImportKind;
  done: boolean;
  added: number;
  skipped: number;
  batchAdded: number;
  batchSkipped: number;
  queued: number;
  label: string;
}

export async function syncVault(id?: string): Promise<number> {
  const url = id ? `/api/sync?id=${encodeURIComponent(id)}` : "/api/sync";
  const response = await fetch(url);
  const payload = (await response.json().catch(() => ({}))) as { added?: unknown; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Vault sync failed (${response.status})`);
  }

  const added = Number(payload.added);
  return Number.isFinite(added) ? added : 0;
}

export async function importHorrorVault(kind: HorrorImportKind): Promise<HorrorImportProgress> {
  const response = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ import: kind }),
  });
  const payload = (await response.json().catch(() => ({}))) as Partial<HorrorImportProgress> & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Horror import failed (${response.status})`);
  }

  return {
    import: payload.import === "horror-collections" ? "horror-collections" : "horror-films",
    done: Boolean(payload.done),
    added: numberOrZero(payload.added),
    skipped: numberOrZero(payload.skipped),
    batchAdded: numberOrZero(payload.batchAdded),
    batchSkipped: numberOrZero(payload.batchSkipped),
    queued: numberOrZero(payload.queued),
    label: String(payload.label ?? "").trim(),
  };
}

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
