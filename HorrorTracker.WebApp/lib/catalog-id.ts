import { HttpError } from "./neon";

export const LIBRARY_MEDIA_KINDS = ["movie", "series", "documentary", "show", "book", "podcast", "game"] as const;

export function parseCatalogId(
  id: string | null | undefined,
  allowed: readonly string[] = LIBRARY_MEDIA_KINDS,
  notFound = "That title was not found.",
  status = 400,
): { kind: string; mediaId: number } {
  const parts = (id ?? "").split(":");
  const mediaId = Number(parts[1]);
  if (parts.length !== 2 || !Number.isInteger(mediaId) || mediaId < 1) {
    throw new HttpError(notFound, status);
  }

  const kind = parts[0].trim().toLowerCase();
  if (!allowed.includes(kind)) {
    throw new HttpError(notFound, status);
  }

  return { kind, mediaId };
}
