import { formatRuntime, MEDIA_KINDS, parsePosterPath, type CatalogEntry, type MediaKind } from "./catalog";
import { keywordsMatchTag, LIBRARY_TAGS } from "./tags";

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

const SAFE_TOP = 280;
const SAFE_BOTTOM = 280;
const MARGIN = 96;
const TITLE_KICKERS = ["Survived", "Another night in the vault", "Made it through"] as const;

export interface TitleStoryCopy {
  kicker: string;
  title: string;
  meta: string;
  series?: string;
  tag?: string;
  byline: string;
}

export interface RecapStoryItem {
  title: string;
  posterPath?: string;
}

export interface RecapStoryCopy {
  heading: string;
  hours: string;
  count: string;
  extras: string[];
  items: RecapStoryItem[];
  empty: boolean;
}

export function kindLabel(kind: MediaKind): string {
  return MEDIA_KINDS.find((item) => item.id === kind)?.label ?? kind;
}

export function titleKicker(title: string): string {
  const value = title.trim();
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash += value.charCodeAt(index);
  }

  return TITLE_KICKERS[hash % TITLE_KICKERS.length];
}

export function storyTag(keywords: string[] | undefined): string | undefined {
  const tag = LIBRARY_TAGS.find((item) => keywordsMatchTag(keywords, item.id));
  return tag?.label;
}

export function watchedByline(displayName: string, watchedIn?: number): string {
  const name = displayName.trim() || "a survivor";
  return watchedIn ? `Watched in ${watchedIn} by ${name}` : `Watched by ${name}`;
}

export function titleStoryCopy(input: {
  title: string;
  year?: number;
  kind: MediaKind;
  displayName: string;
  seriesTitle?: string;
  totalTime?: number;
  keywords?: string[];
  watchedIn?: number;
}): TitleStoryCopy {
  const title = input.title.trim() || "Untitled";
  const runtime = formatRuntime(input.totalTime);
  const meta = [
    input.year && input.year > 0 ? String(input.year) : "",
    kindLabel(input.kind),
    runtime ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
  const series = input.kind === "series" ? undefined : input.seriesTitle?.trim();
  const tag = storyTag(input.keywords);
  return {
    kicker: titleKicker(title),
    title,
    meta,
    ...(series ? { series } : {}),
    ...(tag ? { tag } : {}),
    byline: watchedByline(input.displayName, input.watchedIn),
  };
}

export function recapStoryCopy(input: {
  hoursLabel: string;
  finishedCount: number;
  items: RecapStoryItem[];
  allNighters?: number;
  longestNight?: string;
}): RecapStoryCopy {
  const items = input.items
    .map((item) => ({
      title: item.title.trim(),
      ...(parsePosterPath(item.posterPath) ? { posterPath: parsePosterPath(item.posterPath) } : {}),
    }))
    .filter((item) => item.title)
    .slice(0, 5);
  const empty = input.finishedCount < 1 && items.length < 1;
  if (empty) {
    return {
      heading: "Your nights",
      hours: input.hoursLabel.trim() || "0 hr",
      count: "Mark a title finished to start your nights.",
      extras: [],
      items: [],
      empty: true,
    };
  }

  const extras: string[] = [];
  if (input.allNighters && input.allNighters > 0) {
    extras.push(input.allNighters === 1 ? "1 all-nighter" : `${input.allNighters} all-nighters`);
  }

  const longest = input.longestNight?.trim();
  if (longest) {
    extras.push(`Longest night · ${longest}`);
  }

  const count = input.finishedCount === 1 ? "1 title survived" : `${Math.max(input.finishedCount, items.length)} titles survived`;
  return {
    heading: "Your nights",
    hours: input.hoursLabel.trim() || "0 hr",
    count,
    extras: extras.slice(0, 2),
    items,
    empty: false,
  };
}

export function recapItemsFromCatalog(
  entries: readonly CatalogEntry[],
  recentIds: readonly string[],
  extraPosters: Readonly<Record<string, string>> = {},
): RecapStoryItem[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const items: RecapStoryItem[] = [];
  for (const id of recentIds) {
    const entry = byId.get(id);
    if (!entry || entry.kind === "series") {
      continue;
    }

    const posterPath = parsePosterPath(entry.posterPath ?? extraPosters[entry.id]);
    items.push({
      title: entry.title,
      ...(posterPath ? { posterPath } : {}),
    });
    if (items.length >= 5) {
      break;
    }
  }

  return items;
}

export function finishedTitleCount(entries: readonly CatalogEntry[], finishedIds: readonly string[]): number {
  const finished = new Set(finishedIds);
  return entries.filter((entry) => finished.has(entry.id) && entry.kind !== "series").length;
}

export function storyFilename(slug: string): string {
  const safe = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `horrorverse-${safe || "story"}.png`;
}

export async function renderTitleStoryCard(input: {
  title: string;
  year?: number;
  kind: MediaKind;
  displayName: string;
  seriesTitle?: string;
  totalTime?: number;
  keywords?: string[];
  watchedIn?: number;
  avatar?: string;
  posterPath?: string;
}): Promise<Blob> {
  const copy = titleStoryCopy(input);
  const [avatar, poster] = await Promise.all([loadAvatar(input.avatar), loadPoster(input.posterPath, "w780")]);
  return renderStoryCard((ctx) => paintTitleStory(ctx, copy, avatar, poster));
}

export async function renderRecapStoryCard(input: {
  hoursLabel: string;
  finishedCount: number;
  items: RecapStoryItem[];
  displayName: string;
  allNighters?: number;
  longestNight?: string;
  avatar?: string;
}): Promise<Blob> {
  const copy = recapStoryCopy(input);
  const [avatar, posters] = await Promise.all([
    loadAvatar(input.avatar),
    Promise.all(copy.items.map((item) => loadPoster(item.posterPath, "w185"))),
  ]);
  return renderStoryCard((ctx) => paintRecapStory(ctx, copy, input.displayName.trim() || "a survivor", avatar, posters));
}

async function renderStoryCard(paint: (ctx: CanvasRenderingContext2D) => void): Promise<Blob> {
  await waitForFonts();
  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not draw that story image.");
  }

  paintStoryBackdrop(ctx);
  paint(ctx);
  return canvasToPng(canvas);
}

function paintStoryBackdrop(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  const glow = ctx.createRadialGradient(STORY_WIDTH / 2, SAFE_TOP + 80, 20, STORY_WIDTH / 2, SAFE_TOP, 820);
  glow.addColorStop(0, "rgba(183, 28, 28, 0.38)");
  glow.addColorStop(1, "rgba(10, 10, 10, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  paintVignette(ctx);
  ctx.fillStyle = "#dc143c";
  ctx.fillRect(MARGIN, SAFE_TOP, 88, 5);
  ctx.fillStyle = "#f5f5f5";
  ctx.font = '700 42px "Cinzel", "Palatino Linotype", Palatino, serif';
  ctx.fillText("HorrorVerse", MARGIN, SAFE_TOP + 72);
}

function paintVignette(ctx: CanvasRenderingContext2D): void {
  const top = ctx.createLinearGradient(0, 0, 0, SAFE_TOP);
  top.addColorStop(0, "rgba(0, 0, 0, 0.62)");
  top.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, STORY_WIDTH, SAFE_TOP);

  const bottom = ctx.createLinearGradient(0, STORY_HEIGHT - SAFE_BOTTOM, 0, STORY_HEIGHT);
  bottom.addColorStop(0, "rgba(0, 0, 0, 0)");
  bottom.addColorStop(1, "rgba(0, 0, 0, 0.7)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, STORY_HEIGHT - SAFE_BOTTOM, STORY_WIDTH, SAFE_BOTTOM);
}

function paintTitleStory(
  ctx: CanvasRenderingContext2D,
  copy: TitleStoryCopy,
  avatar: CanvasImageSource | undefined,
  poster: CanvasImageSource | undefined,
): void {
  const contentWidth = STORY_WIDTH - MARGIN * 2;
  ctx.fillStyle = "#dc143c";
  ctx.font = '600 28px "Source Sans 3", "Segoe UI", sans-serif';
  ctx.fillText(copy.kicker.toUpperCase(), MARGIN, SAFE_TOP + 180);

  let y = SAFE_TOP + 220;
  if (poster) {
    const posterWidth = 600;
    const posterHeight = 900;
    paintCoverImage(ctx, poster, (STORY_WIDTH - posterWidth) / 2, y, posterWidth, posterHeight, 18);
    y += posterHeight + 56;
  } else {
    ctx.fillStyle = "#f5f5f5";
    ctx.font = '700 88px "Cinzel", "Palatino Linotype", Palatino, serif';
    y = SAFE_TOP + 320;
    for (const line of wrapText(ctx, copy.title, contentWidth, 4)) {
      ctx.fillText(line, MARGIN, y);
      y += 102;
    }
    y += 12;
  }

  if (copy.meta) {
    ctx.fillStyle = "#b0b0b0";
    ctx.font = '400 30px "Source Sans 3", "Segoe UI", sans-serif';
    ctx.fillText(copy.meta, MARGIN, y);
    y += 52;
  }

  if (copy.series) {
    ctx.fillStyle = "#b0b0b0";
    ctx.font = '400 28px "Source Sans 3", "Segoe UI", sans-serif';
    ctx.fillText(copy.series, MARGIN, y);
    y += 48;
  }

  if (copy.tag) {
    paintTagChip(ctx, copy.tag, MARGIN, y + 8);
  }

  paintByline(ctx, copy.byline, avatar);
}

function paintRecapStory(
  ctx: CanvasRenderingContext2D,
  copy: RecapStoryCopy,
  displayName: string,
  avatar: CanvasImageSource | undefined,
  posters: (CanvasImageSource | undefined)[],
): void {
  const contentWidth = STORY_WIDTH - MARGIN * 2;
  ctx.fillStyle = "#dc143c";
  ctx.font = '600 28px "Source Sans 3", "Segoe UI", sans-serif';
  ctx.fillText(copy.heading.toUpperCase(), MARGIN, SAFE_TOP + 220);

  ctx.fillStyle = "#f5f5f5";
  ctx.font = '700 96px "Cinzel", "Palatino Linotype", Palatino, serif';
  ctx.fillText(copy.hours, MARGIN, SAFE_TOP + 360);

  ctx.fillStyle = "#b0b0b0";
  ctx.font = '400 30px "Source Sans 3", "Segoe UI", sans-serif';
  ctx.fillText(copy.count, MARGIN, SAFE_TOP + 430);

  let y = SAFE_TOP + 520;
  ctx.fillStyle = "#f5f5f5";
  ctx.font = '400 28px "Source Sans 3", "Segoe UI", sans-serif';
  for (const extra of copy.extras) {
    ctx.fillText(extra, MARGIN, y);
    y += 46;
  }

  y += 36;
  const gap = 16;
  const posterWidth = Math.min(176, Math.floor((contentWidth - gap * Math.max(copy.items.length - 1, 0)) / Math.max(copy.items.length, 1)));
  const posterHeight = Math.round(posterWidth * 1.5);
  copy.items.forEach((item, index) => {
    const x = MARGIN + index * (posterWidth + gap);
    const art = posters[index];
    if (art) {
      paintCoverImage(ctx, art, x, y, posterWidth, posterHeight, 12);
      return;
    }

    ctx.fillStyle = "#141414";
    roundRect(ctx, x, y, posterWidth, posterHeight, 12);
    ctx.fill();
    ctx.strokeStyle = "#b71c1c";
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, posterWidth, posterHeight, 12);
    ctx.stroke();
    ctx.fillStyle = "#f5f5f5";
    ctx.font = '600 22px "Cinzel", "Palatino Linotype", Palatino, serif';
    let textY = y + 48;
    for (const line of wrapText(ctx, item.title, posterWidth - 20, 4)) {
      ctx.fillText(line, x + 10, textY);
      textY += 28;
    }
  });

  paintByline(ctx, `Watched by ${displayName}`, avatar);
}

function paintTagChip(ctx: CanvasRenderingContext2D, label: string, x: number, y: number): void {
  ctx.font = '600 24px "Source Sans 3", "Segoe UI", sans-serif';
  const width = ctx.measureText(label).width + 36;
  ctx.strokeStyle = "#b71c1c";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y - 28, width, 44, 22);
  ctx.stroke();
  ctx.fillStyle = "#dc143c";
  ctx.fillText(label, x + 18, y);
}

function paintByline(ctx: CanvasRenderingContext2D, byline: string, avatar?: CanvasImageSource): void {
  const y = STORY_HEIGHT - SAFE_BOTTOM - 24;
  let textX = MARGIN;
  if (avatar) {
    const size = 72;
    const cx = MARGIN + size / 2;
    const cy = y - 8;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, MARGIN, cy - size / 2, size, size);
    ctx.restore();
    ctx.strokeStyle = "#dc143c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.stroke();
    textX = MARGIN + size + 22;
  }

  ctx.fillStyle = "#b0b0b0";
  ctx.font = '400 28px "Source Sans 3", "Segoe UI", sans-serif';
  ctx.fillText(byline, textX, y);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;
    if (lines.length >= maxLines) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines;
}

function paintCoverImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const size = sourceSize(image);
  const scale = Math.max(width / Math.max(size.width, 1), height / Math.max(size.height, 1));
  const drawWidth = size.width * scale;
  const drawHeight = size.height * scale;
  ctx.save();
  roundRect(ctx, x, y, width, height, radius);
  ctx.clip();
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  ctx.restore();
  ctx.strokeStyle = "#b71c1c";
  ctx.lineWidth = 3;
  roundRect(ctx, x, y, width, height, radius);
  ctx.stroke();
}

function sourceSize(image: CanvasImageSource): { width: number; height: number } {
  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
  }

  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    return { width: image.width, height: image.height };
  }

  return { width: Number("width" in image ? image.width : 0), height: Number("height" in image ? image.height : 0) };
}

async function loadPoster(path: string | undefined, size: string): Promise<CanvasImageSource | undefined> {
  const parsed = parsePosterPath(path);
  if (!parsed) {
    return undefined;
  }

  try {
    const response = await fetch(`/api/tmdb?poster=${encodeURIComponent(parsed)}&size=${encodeURIComponent(size)}`);
    if (!response.ok) {
      return undefined;
    }

    const blob = await response.blob();
    if (!blob.type.startsWith("image/") || blob.size < 1) {
      return undefined;
    }

    if (typeof createImageBitmap === "function") {
      return await createImageBitmap(blob);
    }

    return await blobImage(blob);
  } catch {
    return undefined;
  }
}

function blobImage(blob: Blob): Promise<CanvasImageSource | undefined> {
  return new Promise((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    image.src = url;
  });
}

async function loadAvatar(avatar: string | undefined): Promise<CanvasImageSource | undefined> {
  const src = avatar?.trim();
  if (!src || typeof Image === "undefined") {
    return undefined;
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(undefined);
    image.src = src;
  });
}

async function waitForFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.ready) {
    return;
  }

  await document.fonts.ready;
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Could not create that story image."));
    }, "image/png");
  });
}
