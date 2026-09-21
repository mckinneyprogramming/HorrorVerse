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
