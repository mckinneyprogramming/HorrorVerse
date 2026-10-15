import { MEDIA_KINDS, type CatalogEntry, type MediaKind } from "./catalog";

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

export interface TitleStoryCopy {
  kicker: string;
  title: string;
  meta: string;
  byline: string;
}

export interface RecapStoryCopy {
  heading: string;
  hours: string;
  count: string;
  titles: string[];
  empty: boolean;
}

export function kindLabel(kind: MediaKind): string {
  return MEDIA_KINDS.find((item) => item.id === kind)?.label ?? kind;
}

export function titleStoryCopy(input: {
  title: string;
  year?: number;
  kind: MediaKind;
  displayName: string;
}): TitleStoryCopy {
  const title = input.title.trim() || "Untitled";
  const meta = [input.year && input.year > 0 ? String(input.year) : "", kindLabel(input.kind)].filter(Boolean).join(" · ");
  const name = input.displayName.trim() || "a survivor";
  return {
    kicker: "Survived",
    title,
    meta,
    byline: `Watched by ${name}`,
  };
}

export function recapStoryCopy(input: {
  hoursLabel: string;
  finishedCount: number;
  titles: string[];
}): RecapStoryCopy {
  const titles = input.titles.map((title) => title.trim()).filter(Boolean).slice(0, 5);
  const empty = input.finishedCount < 1 && titles.length < 1;
  if (empty) {
    return {
      heading: "Your nights",
      hours: input.hoursLabel.trim() || "0 hr",
      count: "Mark a title finished to start your nights.",
      titles: [],
      empty: true,
    };
  }

  const count = input.finishedCount === 1 ? "1 title survived" : `${Math.max(input.finishedCount, titles.length)} titles survived`;
  return {
    heading: "Your nights",
    hours: input.hoursLabel.trim() || "0 hr",
    count,
    titles,
    empty: false,
  };
}

export function recapTitlesFromCatalog(entries: readonly CatalogEntry[], recentIds: readonly string[]): string[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const titles: string[] = [];
  for (const id of recentIds) {
    const entry = byId.get(id);
    if (!entry || entry.kind === "series") {
      continue;
    }

    titles.push(entry.title);
    if (titles.length >= 5) {
      break;
    }
  }

  return titles;
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
}): Promise<Blob> {
  return renderStoryCard((ctx) => paintTitleStory(ctx, titleStoryCopy(input)));
}

export async function renderRecapStoryCard(input: {
  hoursLabel: string;
  finishedCount: number;
  titles: string[];
  displayName: string;
}): Promise<Blob> {
  return renderStoryCard((ctx) => paintRecapStory(ctx, recapStoryCopy(input), input.displayName.trim() || "a survivor"));
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
  const glow = ctx.createRadialGradient(STORY_WIDTH / 2, 280, 40, STORY_WIDTH / 2, 200, 900);
  glow.addColorStop(0, "rgba(183, 28, 28, 0.42)");
  glow.addColorStop(1, "rgba(10, 10, 10, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  ctx.fillStyle = "#dc143c";
  ctx.fillRect(96, 120, 120, 6);
  ctx.fillStyle = "#f5f5f5";
  ctx.font = '700 54px "Cinzel", "Palatino Linotype", Palatino, serif';
  ctx.fillText("HorrorVerse", 96, 210);
}

function paintTitleStory(ctx: CanvasRenderingContext2D, copy: TitleStoryCopy): void {
  ctx.fillStyle = "#dc143c";
  ctx.font = '600 36px "Source Sans 3", "Segoe UI", sans-serif';
  ctx.fillText(copy.kicker.toUpperCase(), 96, 520);
  ctx.fillStyle = "#f5f5f5";
  ctx.font = '700 72px "Cinzel", "Palatino Linotype", Palatino, serif';
  let y = 640;
  for (const line of wrapText(ctx, copy.title, STORY_WIDTH - 192)) {
    ctx.fillText(line, 96, y);
    y += 88;
  }

  if (copy.meta) {
    ctx.fillStyle = "#b0b0b0";
    ctx.font = '400 32px "Source Sans 3", "Segoe UI", sans-serif';
    ctx.fillText(copy.meta, 96, y + 24);
  }

  ctx.fillStyle = "#757575";
  ctx.font = '400 28px "Source Sans 3", "Segoe UI", sans-serif';
  ctx.fillText(copy.byline, 96, STORY_HEIGHT - 160);
}

function paintRecapStory(ctx: CanvasRenderingContext2D, copy: RecapStoryCopy, displayName: string): void {
  ctx.fillStyle = "#dc143c";
  ctx.font = '600 36px "Source Sans 3", "Segoe UI", sans-serif';
  ctx.fillText(copy.heading.toUpperCase(), 96, 460);
  ctx.fillStyle = "#f5f5f5";
  ctx.font = '700 72px "Cinzel", "Palatino Linotype", Palatino, serif';
  ctx.fillText(copy.hours, 96, 580);
  ctx.fillStyle = "#b0b0b0";
  ctx.font = '400 32px "Source Sans 3", "Segoe UI", sans-serif';
  ctx.fillText(copy.count, 96, 660);

  let y = 780;
  ctx.fillStyle = "#f5f5f5";
  ctx.font = '500 40px "Cinzel", "Palatino Linotype", Palatino, serif';
  for (const title of copy.titles) {
    for (const line of wrapText(ctx, title, STORY_WIDTH - 192)) {
      ctx.fillText(line, 96, y);
      y += 56;
    }
    y += 18;
  }

  ctx.fillStyle = "#757575";
  ctx.font = '400 28px "Source Sans 3", "Segoe UI", sans-serif';
  ctx.fillText(`Watched by ${displayName}`, 96, STORY_HEIGHT - 160);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 1) {
    return [text];
  }

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
    if (lines.length >= 5) {
      break;
    }
  }

  if (current && lines.length < 6) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [text];
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
