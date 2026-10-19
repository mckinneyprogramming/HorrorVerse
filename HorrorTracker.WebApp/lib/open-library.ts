import { execute, HttpError, queryRows } from "./neon";
import { asId } from "./tmdb";

const USER_AGENT = "HorrorVerse/1.0 (https://horrorverse.vercel.app)";
const MAX_RESULTS = 8;
const MAX_SUBJECTS = 12;

export interface OpenLibraryHit {
  sourceId: string;
  title: string;
  year?: number;
  overview?: string;
  coverUrl?: string;
}

export interface OpenLibraryBook {
  sourceId: string;
  title: string;
  author?: string;
  year: number;
  pages: number;
  description?: string;
  isbn?: string;
  publisher?: string;
  coverUrl?: string;
  subjects: string[];
}

export function parseWorkId(value: unknown): string | undefined {
  const raw = String(value ?? "").trim();
  const key = raw.startsWith("/works/") ? raw.slice("/works/".length) : raw;
  return /^OL\d+W$/.test(key) ? key : undefined;
}

export function openLibraryCoverUrl(coverId: unknown): string | undefined {
  const id = Number(coverId);
  if (!Number.isInteger(id) || id < 1) {
    return undefined;
  }

  return `https://covers.openlibrary.org/b/id/${id}-M.jpg`;
}

export function parseOpenLibrarySearch(payload: unknown): OpenLibraryHit[] {
  const docs = docsOf(payload);
  const hits: OpenLibraryHit[] = [];
  for (const doc of docs) {
    if (hits.length >= MAX_RESULTS) {
      break;
    }

    const sourceId = parseWorkId(doc.key);
    const title = cleanText(doc.title, 200);
    if (!sourceId || !title) {
      continue;
    }

    const author = joinNames(doc.author_name, 180);
    const subjects = namesOf(doc.subject).slice(0, 3);
    const overview = [author, subjects.join(", ")].filter(Boolean).join(" · ");
    const year = yearOf(doc.first_publish_year);
    const coverUrl = openLibraryCoverUrl(doc.cover_i);
    hits.push({
      sourceId,
      title,
      ...(year ? { year } : {}),
      ...(overview ? { overview } : {}),
      ...(coverUrl ? { coverUrl } : {}),
    });
  }

  return hits;
}

export function parseOpenLibraryWork(workId: string, work: unknown, searchDoc: unknown): OpenLibraryBook | undefined {
  const sourceId = parseWorkId(workId);
  const record = asRecord(work);
  const doc = asRecord(searchDoc);
  const title = titled(cleanText(record?.title, 160), cleanText(doc?.title, 160), cleanText(record?.subtitle ?? doc?.subtitle, 80));
  if (!sourceId || !title) {
    return undefined;
  }

  const author = joinNames(doc?.author_name, 180);
  const year = yearOf(doc?.first_publish_year) ?? 0;
  const pages = positiveInt(doc?.number_of_pages_median) ?? 0;
  const description = cleanText(descriptionOf(record?.description), 4000);
  const isbn = pickIsbn(doc?.isbn);
  const publisher = namesOf(doc?.publisher)[0];
  const coverUrl = openLibraryCoverUrl(doc?.cover_i) ?? openLibraryCoverUrl(firstOf(record?.covers));
  const subjects = uniqueNames([...(namesOf(record?.subjects)), ...(namesOf(doc?.subject))]).slice(0, MAX_SUBJECTS);
  return {
    sourceId,
    title,
    year,
    pages,
    subjects,
    ...(author ? { author } : {}),
    ...(description ? { description } : {}),
    ...(isbn ? { isbn } : {}),
    ...(publisher ? { publisher: publisher.slice(0, 200) } : {}),
    ...(coverUrl ? { coverUrl } : {}),
  };
}

export async function searchOpenLibrary(query: string): Promise<OpenLibraryHit[]> {
  const payload = await openLibraryJson(
    `/search.json?q=${encodeURIComponent(query)}&limit=${MAX_RESULTS}&fields=key,title,subtitle,author_name,first_publish_year,cover_i,subject`,
  );
  return parseOpenLibrarySearch(payload);
}

export async function importOpenLibraryBook(connectionString: string, workId: string): Promise<{ added: number; id: string }> {
  const sourceId = parseWorkId(workId);
  if (!sourceId) {
    throw new HttpError("Choose an Open Library book to add.", 400);
  }

  await ensureBookColumns(connectionString);
  const [work, search] = await Promise.all([
    openLibraryJson(`/works/${sourceId}.json`),
    openLibraryJson(
      `/search.json?q=${encodeURIComponent(`key:/works/${sourceId}`)}&limit=1&fields=title,subtitle,author_name,first_publish_year,cover_i,number_of_pages_median,isbn,publisher,subject`,
    ),
  ]);
  const book = parseOpenLibraryWork(sourceId, work, docsOf(search)[0]);
  if (!book) {
    throw new HttpError("Open Library did not return that book.", 502);
  }

  const existing = await queryRows(connectionString, "SELECT id FROM book WHERE openlibraryid = $1 LIMIT 1", [book.sourceId]);
  const existingId = asId(existing[0]);
  const bookId = existingId ?? (await insertBook(connectionString, book));
  await updateBook(connectionString, bookId, book);
  await saveBookSubjects(connectionString, bookId, book.subjects);
  return { added: existingId ? 0 : 1, id: `book:${bookId}` };
}

async function insertBook(connectionString: string, book: OpenLibraryBook): Promise<number> {
  const rows = await queryRows(
    connectionString,
    `INSERT INTO book (title, seriesid, pages, partofseries, releaseyear, read, openlibraryid)
     VALUES ($1, NULL, $2, FALSE, $3, FALSE, $4)
     RETURNING id`,
    [book.title, book.pages, book.year, book.sourceId],
  );
  const id = asId(rows[0]);
  if (!id) {
    throw new HttpError("Could not save that book.", 500);
  }

  return id;
}

async function updateBook(connectionString: string, bookId: number, book: OpenLibraryBook): Promise<void> {
  await execute(
    connectionString,
    `UPDATE book
     SET title = $2,
         pages = CASE WHEN $3 > 0 THEN $3 ELSE pages END,
         releaseyear = CASE WHEN $4 > 0 THEN $4 ELSE releaseyear END,
         openlibraryid = $5,
         author = $6,
         description = $7,
         isbn = $8,
         publisher = $9,
         coverurl = $10
     WHERE id = $1`,
    [
      bookId,
      book.title,
      book.pages,
      book.year,
      book.sourceId,
      book.author ?? null,
      book.description ?? null,
      book.isbn ?? null,
      book.publisher ?? null,
      book.coverUrl ?? null,
    ],
  );
}

async function saveBookSubjects(connectionString: string, bookId: number, subjects: string[]): Promise<void> {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS media_keyword (
      media_kind TEXT NOT NULL,
      media_id INTEGER NOT NULL,
      tmdb_keyword_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY (media_kind, media_id, tmdb_keyword_id)
    )`,
  );
  await execute(connectionString, "DELETE FROM media_keyword WHERE media_kind = 'book' AND media_id = $1", [bookId]);
  for (const subject of subjects) {
    await execute(
      connectionString,
      `INSERT INTO media_keyword (media_kind, media_id, tmdb_keyword_id, name)
       VALUES ('book', $1, $2, $3)
       ON CONFLICT (media_kind, media_id, tmdb_keyword_id) DO UPDATE SET name = EXCLUDED.name`,
      [bookId, subjectKey(subject), subject],
    );
  }
}

export async function ensureBookColumns(connectionString: string): Promise<void> {
  await execute(
    connectionString,
    `CREATE TABLE IF NOT EXISTS book (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      seriesid INTEGER,
      pages INTEGER NOT NULL,
      partofseries BOOLEAN NOT NULL,
      releaseyear INTEGER NOT NULL,
      read BOOLEAN NOT NULL
    )`,
  );
  await execute(connectionString, "ALTER TABLE book ADD COLUMN IF NOT EXISTS openlibraryid TEXT");
  await execute(connectionString, "ALTER TABLE book ADD COLUMN IF NOT EXISTS author TEXT");
  await execute(connectionString, "ALTER TABLE book ADD COLUMN IF NOT EXISTS description TEXT");
  await execute(connectionString, "ALTER TABLE book ADD COLUMN IF NOT EXISTS isbn TEXT");
  await execute(connectionString, "ALTER TABLE book ADD COLUMN IF NOT EXISTS publisher TEXT");
  await execute(connectionString, "ALTER TABLE book ADD COLUMN IF NOT EXISTS coverurl TEXT");
}

function subjectKey(name: string): number {
  let hash = 0;
  for (const char of name.toLowerCase()) {
    hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  }

  return (hash % 2_000_000_000) || 1;
}

async function openLibraryJson(path: string): Promise<unknown> {
  const response = await fetch(`https://openlibrary.org${path}`, {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new HttpError("Could not reach Open Library.", 502);
  }

  return response.json();
}

function docsOf(payload: unknown): Record<string, unknown>[] {
  const record = asRecord(payload);
  return Array.isArray(record?.docs) ? record.docs.map(asRecord).filter((doc): doc is Record<string, unknown> => Boolean(doc)) : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function descriptionOf(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  const record = asRecord(value);
  return typeof record?.value === "string" ? record.value : "";
}

function titled(workTitle: string | undefined, searchTitle: string | undefined, subtitle: string | undefined): string | undefined {
  const title = workTitle || searchTitle;
  if (!title) {
    return undefined;
  }

  if (!subtitle || title.toLowerCase().includes(subtitle.toLowerCase())) {
    return title;
  }

  const combined = `${title}: ${subtitle}`;
  return combined.length <= 200 ? combined : title;
}

function joinNames(value: unknown, max: number): string | undefined {
  const names = namesOf(value);
  if (names.length < 1) {
    return undefined;
  }

  return names.slice(0, 4).join(", ").slice(0, max);
}

function namesOf(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueNames(value.map((item) => cleanText(item, 80)).filter((item): item is string => Boolean(item)));
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(name);
  }

  return unique;
}

function pickIsbn(value: unknown): string | undefined {
  const isbns = namesOf(value).map((isbn) => isbn.replace(/[^0-9X]/gi, ""));
  return isbns.find((isbn) => isbn.length === 13) ?? isbns.find((isbn) => isbn.length === 10);
}

function yearOf(value: unknown): number | undefined {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1 && year <= 3000 ? year : undefined;
}

function positiveInt(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function firstOf(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : undefined;
}

function cleanText(value: unknown, max: number): string | undefined {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    return undefined;
  }

  return text.length > max ? text.slice(0, max).trim() : text;
}
