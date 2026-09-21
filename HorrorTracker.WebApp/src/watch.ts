export interface WatchProvider {
  name: string;
  logo?: string;
}

export interface WatchOffer {
  title: string;
  region: string;
  link?: string;
  streaming: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
  free: WatchProvider[];
  attribution: string;
}

export async function fetchWatch(id: string): Promise<WatchOffer> {
  const response = await fetch(`/api/watch?id=${encodeURIComponent(id)}`);
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(payload.error ?? `Watch lookup failed (${response.status})`));
  }

  const offer = readOffer(payload);
  if (!offer) {
    throw new Error("Watch lookup did not return providers.");
  }

  return offer;
}

function readOffer(value: unknown): WatchOffer | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title = String(record.title ?? record.Title ?? "").trim();
  if (!title) {
    return null;
  }

  const link = String(record.link ?? record.Link ?? "").trim();
  const attribution = String(record.attribution ?? record.Attribution ?? "JustWatch").trim() || "JustWatch";
  return {
    title,
    region: String(record.region ?? record.Region ?? "US").trim() || "US",
    ...(link ? { link } : {}),
    streaming: readProviders(record.streaming ?? record.Streaming),
    rent: readProviders(record.rent ?? record.Rent),
    buy: readProviders(record.buy ?? record.Buy),
    free: readProviders(record.free ?? record.Free),
    attribution,
  };
}

function readProviders(value: unknown): WatchProvider[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const providers: WatchProvider[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const name = String(record.name ?? record.Name ?? "").trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) {
      continue;
    }

    seen.add(key);
    const logo = String(record.logo ?? record.Logo ?? "").trim();
    providers.push({
      name,
      ...(logo ? { logo } : {}),
    });
  }

  return providers;
}
