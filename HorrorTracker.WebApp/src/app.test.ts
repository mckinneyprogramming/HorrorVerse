// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogEntry } from "./catalog";

vi.mock("virtual:pwa-register", () => ({
  registerSW(options: {
    onNeedRefresh?: () => void;
    onRegisteredSW?: (url: string, registration: { update: () => Promise<void> } | undefined) => void;
  }) {
    options.onRegisteredSW?.("https://horrorverse.example/sw.js", { update: async () => undefined });
    options.onNeedRefresh?.();
    return async () => undefined;
  },
}));

vi.mock("./share", () => ({
  shareStoryImage: vi.fn(async () => "saved" as const),
}));

vi.mock("./story", async () => {
  const actual = await vi.importActual<typeof import("./story")>("./story");
  return {
    ...actual,
    renderTitleStoryCard: vi.fn(async () => new Blob(["title"], { type: "image/png" })),
    renderRecapStoryCard: vi.fn(async () => new Blob(["recap"], { type: "image/png" })),
  };
});

type User = {
  id: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
  aboutMe?: string;
  avatar?: string;
};

type Person = {
  id: number;
  displayName: string;
  aboutMe?: string;
  avatar?: string;
  friendCount: number;
  followerCount: number;
  followingCount: number;
  relation: "self" | "none" | "outgoing" | "incoming" | "friends";
  following: boolean;
  followedBy: boolean;
  lists?: { id: number; name: string; items: string[]; visibility: "private" | "public" }[];
  finishedIds?: string[];
};

type List = { id: number; name: string; items: string[]; visibility: "private" | "public" };
type Franchise = { id: number; name: string; items: string[] };
type Guide = {
  id: string;
  showId: number;
  seasons: {
    id: number;
    seasonNumber: number;
    title: string;
    episodeCount: number;
    finishedCount: number;
    loaded: boolean;
    episodes: {
      id: number;
      episodeNumber: number;
      title: string;
      runtime: number;
      year?: number;
      completed: boolean;
      watchedYear?: number;
      undated?: boolean;
    }[];
  }[];
};

type Progress = {
  ids: string[];
  recentIds: string[];
  undatedIds: string[];
  watchedYears: Record<string, number>;
  scores: Record<string, number>;
  recentPosters: Record<string, string>;
  watchNext: { id: string; title: string; kind: string; reason: string; detail?: string; posterPath?: string }[];
  readNext: { id: string; title: string; kind: string; reason: string; detail?: string; posterPath?: string }[];
};

type World = {
  user: User | null;
  catalog: CatalogEntry[];
  franchises: Franchise[];
  lists: List[];
  progress: Progress;
  nextProgress?: Progress;
  friends: { friends: Person[]; incoming: Person[]; outgoing: Person[]; following: Person[] };
  people: Person[];
  search: Person[];
  guides: Record<number, Guide>;
  upcoming: { films: Record<string, unknown>[]; shows: Record<string, unknown>[] };
  sync: { added: number; postersFilled: number };
  tmdb: Record<string, unknown>[];
  importId: string;
  watch: Record<string, unknown>;
  down: Set<string>;
  downMode: "status" | "string";
  failCatalogOnce: boolean;
  horrorQueue: Record<string, unknown>[];
  horrorThrow?: unknown;
  reuseFranchiseIds: boolean;
};

const admin: User = {
  id: 1,
  email: "ada@vault.test",
  displayName: "Ada <Admin>",
  isAdmin: true,
  aboutMe: "I keep the gate.",
  avatar: "data:image/gif;base64,abc",
};

const member: User = { id: 2, email: "bo@vault.test", displayName: "Bo", isAdmin: false };

function todayIso(offset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const TODAY = todayIso();

function entry(partial: CatalogEntry): CatalogEntry {
  return partial;
}

function createWorld(): World {
  const catalog: CatalogEntry[] = [
    entry({ id: "series:10", mediaId: 10, title: "Scream Collection", kind: "series", completed: false, releaseYear: 1996, posterPath: "/series.jpg", keywords: ["slasher"] }),
    entry({ id: "series:11", mediaId: 11, title: "Empty Saga", kind: "series", completed: false }),
    entry({ id: "series:14", mediaId: 14, title: "Alpha Saga", kind: "series", completed: false, posterPath: "/alpha.jpg" }),
    entry({ id: "series:15", mediaId: 15, title: "Beta Saga", kind: "series", completed: false }),
    entry({ id: "movie:1", mediaId: 1, title: "Scream", kind: "movie", completed: true, totalTime: 111, releaseYear: 1996, seriesId: 10, seriesTitle: "Scream", keywords: ["slasher"], posterPath: "/scream.jpg" }),
    entry({ id: "movie:2", mediaId: 2, title: "Scream 2", kind: "movie", completed: false, totalTime: 120, releaseYear: 1997, seriesId: 10, keywords: ["slasher"] }),
    entry({ id: "movie:91", mediaId: 91, title: "Scream Draft", kind: "movie", completed: false, seriesId: 10 }),
    entry({ id: "movie:92", mediaId: 92, title: "Bare Sequel", kind: "movie", completed: false, seriesId: 10 }),
    entry({ id: "movie:3", mediaId: 3, title: "Orphan", kind: "movie", completed: false, releaseYear: 2009, keywords: ["zombie"] }),
    entry({ id: "movie:90", mediaId: 90, title: "Lost Film", kind: "movie", completed: false, seriesId: 99 }),
    entry({ id: "movie:80", mediaId: 80, title: "Same", kind: "movie", completed: false, releaseYear: 2000 }),
    entry({ id: "movie:81", mediaId: 81, title: "Same", kind: "movie", completed: false, releaseYear: 2000 }),
    entry({ id: "movie:82", mediaId: 82, title: "Same", kind: "movie", completed: false, releaseYear: 2002 }),
    entry({ id: "movie:83", mediaId: 83, title: "Undated Night", kind: "movie", completed: false }),
    entry({ id: "movie:84", mediaId: 84, title: "Other Night", kind: "movie", completed: false }),
    entry({ id: "movie:93", mediaId: 93, title: "Alpha One", kind: "movie", completed: false, releaseYear: 2001, seriesId: 14 }),
    entry({ id: "movie:93", mediaId: 930, title: "Alpha Zero", kind: "movie", completed: false, releaseYear: 2001, seriesId: 14 }),
    entry({ id: "movie:94", mediaId: 94, title: "Alpha Two", kind: "movie", completed: false, releaseYear: 2001, seriesId: 14 }),
    entry({ id: "movie:95", mediaId: 95, title: "Beta One", kind: "movie", completed: false, releaseYear: 1980, seriesId: 15, totalTime: 90 }),
    entry({ id: "show:4", mediaId: 4, title: "The Zone", kind: "show", completed: false, releaseYear: 2019, totalTime: 500, totalEpisodes: 10, numberOfSeasons: 3, posterPath: "/zone.jpg", keywords: ["vampire"] }),
    entry({ id: "show:5", mediaId: 5, title: "One Season", kind: "show", completed: false, releaseYear: 2020, posterPath: "/one.jpg" }),
    entry({ id: "show:6", mediaId: 6, title: "Bare Show", kind: "show", completed: false }),
    entry({ id: "documentary:6", mediaId: 6, title: "Cropsey", kind: "documentary", completed: false, releaseYear: 2009, totalTime: 84, posterPath: "/crop.jpg", keywords: ["serial killer"] }),
    entry({ id: "book:7", mediaId: 7, title: "It", kind: "book", completed: false, releaseYear: 1986, author: "Stephen King", pages: 1138, publisher: "Viking", description: "A short clown story.", coverUrl: "https://covers.openlibrary.org/b/id/42-M.jpg", isbn: "9780670813025", keywords: ["vampire"] }),
    entry({ id: "book:8", mediaId: 8, title: "The Long Tome", kind: "book", completed: false, pages: 1, description: "D".repeat(200), author: "Anon" }),
    entry({ id: "podcast:31", mediaId: 31, title: "Voices", kind: "podcast", completed: false, releaseYear: 2021 }),
    entry({ id: "podcast:32", mediaId: 32, title: "Quiet Cast", kind: "podcast", completed: false }),
    entry({ id: "game:33", mediaId: 33, title: "Resident Evil", kind: "game", completed: false, releaseYear: 1996, developer: "Capcom", platforms: "PlayStation", description: "A mansion.", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r74.jpg" }),
    entry({ id: "game:34", mediaId: 34, title: "Silent Hill", kind: "game", completed: false }),
    entry({ id: "movie:70", mediaId: 70, title: "Rock & Roll <Night> \"Fun\" 'Times'", kind: "movie", completed: false, releaseYear: 1984, totalTime: 95, posterPath: "/rock.jpg" }),
  ];

  for (let index = 0; index < 22; index += 1) {
    catalog.push(entry({ id: `movie:${200 + index}`, mediaId: 200 + index, title: `Bulk ${String(index).padStart(2, "0")}`, kind: "movie", completed: false, releaseYear: 1990 + (index % 5) }));
  }

  const episode = (id: number, completed: boolean, extra: Record<string, unknown> = {}) => ({
    id,
    episodeNumber: id,
    title: id === 10 ? "Pilot & <Night>" : "Next",
    runtime: id === 10 ? 45 : 0,
    completed,
    ...extra,
  });

  const guides: Record<number, Guide> = {
    4: {
      id: "show:4",
      showId: 4,
      seasons: [
        { id: 1, seasonNumber: 1, title: "Season 1", episodeCount: 2, finishedCount: 2, loaded: true, episodes: [episode(10, true, { year: 2019, watchedYear: 2020 }), episode(11, false, { undated: true })] },
        { id: 2, seasonNumber: 2, title: "Season 2", episodeCount: 3, finishedCount: 0, loaded: false, episodes: [] },
        { id: 3, seasonNumber: 3, title: "Empty", episodeCount: 0, finishedCount: 0, loaded: true, episodes: [] },
      ],
    },
    5: {
      id: "show:5",
      showId: 5,
      seasons: [{ id: 5, seasonNumber: 1, title: "Only", episodeCount: 1, finishedCount: 0, loaded: true, episodes: [episode(50, false, { year: 2020, runtime: 30 })] }],
    },
    6: { id: "show:6", showId: 6, seasons: [] },
  };

  const person = (partial: Person): Person => ({
    friendCount: 1,
    followerCount: 2,
    followingCount: 3,
    relation: "none",
    following: false,
    followedBy: false,
    ...partial,
  });

  const people = [
    person({ id: 1, displayName: "Ada <Admin>", relation: "self", aboutMe: "Owner" }),
    person({ id: 3, displayName: "Cara", relation: "incoming", aboutMe: "Hi", avatar: "https://example.test/c.png" }),
    person({ id: 4, displayName: "Dex", relation: "outgoing" }),
    person({ id: 5, displayName: "Eve", relation: "none" }),
    person({ id: 6, displayName: "Finn", relation: "none", following: true }),
    person({
      id: 7,
      displayName: "Gina",
      relation: "friends",
      aboutMe: "Night owl",
      avatar: "https://example.test/g.png",
      followedBy: true,
      finishedIds: ["movie:1", "book:7"],
      lists: [
        { id: 70, name: "Public nights", items: ["series:10", "movie:1", "book:7"], visibility: "public" },
        { id: 71, name: "Bare list", items: [], visibility: "public" },
        { id: 72, name: "Missing", items: ["nope"], visibility: "public" },
      ],
    }),
    person({ id: 8, displayName: "Hugh", relation: "none" }),
    person({ id: 9, displayName: "Ivy", relation: "friends" }),
    person({ id: 99, displayName: "Shadow Self", relation: "self" }),
  ];

  const films = [
    ...Array.from({ length: 21 }, (_, index) => ({ kind: "film", tmdbId: 800 + index, title: `August ${index} & <soon>`, releaseDate: "2099-08-01", posterPath: index % 2 === 0 ? "/aug.jpg" : undefined, overview: index === 0 ? "Soon." : "", detail: index === 1 ? "Limited" : "" })),
    { kind: "film", tmdbId: 1, title: "Out Tonight", releaseDate: TODAY, posterPath: "/tonight.jpg", overview: "Tonight's synopsis", detail: "Midnight" },
    { kind: "film", tmdbId: 2, title: "Bare Today", releaseDate: TODAY },
    { kind: "film", tmdbId: 3, title: "Month Zero", releaseDate: "2099-00-10" },
    { kind: "film", tmdbId: 4, title: "Day Zero", releaseDate: "2099-11-00", detail: "Short" },
    { kind: "film", tmdbId: 5, title: "Day Zero Two", releaseDate: "2099-11-04" },
  ];

  const shows = [
    { kind: "show", tmdbId: 6, title: "Future Series", releaseDate: "2098-04-02", overview: "A new series" },
    { kind: "episode", tmdbId: 7, title: "Today Episode", releaseDate: TODAY, detail: "S1E1" },
    { kind: "show", tmdbId: 8, title: "Today Series", releaseDate: TODAY, overview: "Premieres", posterPath: "/prem.jpg" },
  ];

  return {
    user: admin,
    catalog,
    franchises: [
      { id: 1, name: "Scream Saga", items: ["series:10", "movie:1", "movie:2", "movie:91", "show:4", "documentary:6", "book:7", "podcast:31", "game:33", "movie:3", "series:11"] },
      { id: 2, name: "Pair", items: ["movie:1", "movie:2"] },
      { id: 3, name: "Empty Night", items: [] },
      { id: 4, name: "Series Only", items: ["series:11"] },
      { id: 5, name: "Films Only", items: ["movie:3", "movie:80"] },
    ],
    lists: [
      { id: 1, name: "October", items: ["series:10", "movie:1", "movie:2", "movie:91", "show:4", "book:7", "movie:3", "game:33", "podcast:31", "documentary:6"], visibility: "private" },
      { id: 2, name: "Empty", items: [], visibility: "public" },
      { id: 3, name: "Shows", items: ["show:6", "movie:3"], visibility: "private" },
      { id: 4, name: "Saga only", items: ["series:11"], visibility: "private" },
      { id: 5, name: "Just films", items: ["movie:3", "movie:80"], visibility: "private" },
    ],
    progress: {
      ids: ["movie:1", "movie:2", "show:4", "documentary:6", "book:7", "series:10", "game:33", "podcast:32", "movie:70"],
      recentIds: ["movie:1", "podcast:32", "series:10", "movie:3", "book:8"],
      undatedIds: ["movie:2"],
      watchedYears: { "movie:1": 2020, "missing:1": 1999 },
      scores: { "movie:1": 4 },
      recentPosters: { "movie:3": "/orphan.jpg", "book:8": "/tome.jpg" },
      watchNext: [
        { id: "movie:1", title: "Scream", kind: "movie", reason: "episode", detail: "Continue the cut", posterPath: "/scream.jpg" },
        { id: "movie:3", title: "Orphan", kind: "movie", reason: "series" },
        { id: "documentary:6", title: "Cropsey", kind: "documentary", reason: "vault" },
        { id: "show:4", title: "The Zone", kind: "show", reason: "list", detail: "Season 2" },
        { id: "movie:999", title: "Ghost", kind: "movie", reason: "vault" },
      ],
      readNext: [{ id: "book:7", title: "It", kind: "book", reason: "list", detail: "Page 10" }],
    },
    friends: {
      friends: people.filter((item) => item.id === 7),
      incoming: people.filter((item) => item.id === 3),
      outgoing: people.filter((item) => item.id === 4),
      following: people.filter((item) => item.id === 6),
    },
    people,
    search: people.filter((item) => [5, 6, 1, 3, 99].includes(item.id)),
    guides,
    upcoming: { films, shows },
    sync: { added: 0, postersFilled: 0 },
    tmdb: [
      { tmdbId: 55, title: "Found Film", year: 1999, overview: "A match", coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1r74.jpg" },
      { sourceId: "OL12W", title: "Found Book" },
      { sourceId: "bad", title: "Bad Book" },
      { sourceId: "99", title: "Found Game", year: 1996 },
      { sourceId: "12a", title: "Bad Game" },
      { title: "No Id" },
    ],
    importId: "movie:1",
    watch: {
      title: "Scream",
      region: "US",
      link: "https://www.themoviedb.org/movie/1",
      streaming: [{ name: "Shudder", logo: "https://image.tmdb.org/t/p/w45/s.jpg" }, { name: "shudder" }],
      free: [{ name: "Tubi" }],
      rent: [{ name: "Prime" }],
      buy: [{ name: "Apple" }],
      attribution: "JustWatch",
    },
    down: new Set(),
    downMode: "status",
    failCatalogOnce: false,
    horrorQueue: [
      { import: "horror-films", done: false, added: 1, skipped: 2, batchAdded: 1, batchSkipped: 0, queued: 0, label: "first batch" },
      { import: "horror-films", done: false, added: 1, skipped: 3, batchAdded: 0, batchSkipped: 1, queued: 1, label: "second" },
      { import: "horror-films", done: true, added: 4, skipped: 3, batchAdded: 1, batchSkipped: 0, queued: 3, label: "finished" },
    ],
    reuseFranchiseIds: false,
  };
}

let world = createWorld();
const gates = new Map<string, { promise: Promise<void>; release: () => void; waiting: boolean }>();
const oneShots: { key: string; error: unknown }[] = [];
let confirms: boolean[] = [];
let prompts: Array<string | null> = [];
let bitmapMode: "ok" | "throw-string" | "throw-error" = "ok";
let contextMode: "ok" | "null" = "ok";
let dataUrl = "data:image/jpeg;base64,abc";
let standaloneMatch = false;
let navStandalone = false;

const originalWindowAdd = window.addEventListener.bind(window);
const originalWindowRemove = window.removeEventListener.bind(window);
const originalDocumentAdd = document.addEventListener.bind(document);
const originalDocumentRemove = document.removeEventListener.bind(document);
const tracked: { target: EventTarget; type: string; listener: EventListenerOrEventListenerObject }[] = [];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function keyOf(method: string, pathname: string): string {
  return `${method} ${pathname}`;
}

function arm(key: string): void {
  let release!: () => void;
  const gate = { waiting: false, release: () => release(), promise: Promise.resolve() };
  gate.promise = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  gates.set(key, gate);
}

async function block(key: string): Promise<void> {
  const gate = gates.get(key);
  if (!gate) return;
  gate.waiting = true;
  await gate.promise;
  gates.delete(key);
}

async function untilWaiting(key: string): Promise<void> {
  await vi.waitFor(() => {
    if (!gates.get(key)?.waiting) throw new Error(`still working ${key}`);
  });
}

function failNext(key: string, error: unknown): void {
  oneShots.push({ key, error });
}

function personById(id: number): Person | undefined {
  return world.people.find((person) => person.id === id);
}

async function handle(input: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const url = new URL(input, "http://localhost");
  const path = url.pathname;
  const key = keyOf(method, path);
  await block(key);
  const shot = oneShots.findIndex((item) => item.key === key);
  if (shot >= 0) {
    const [{ error }] = oneShots.splice(shot, 1);
    if (error === "status") return json({ error: "Nope" }, 500);
    throw error;
  }
  if (world.down.has(path)) {
    if (world.downMode === "string") throw "offline";
    return json({ error: "Nope" }, 500);
  }
  if (path === "/api/catalog" && method === "GET" && world.failCatalogOnce) {
    world.failCatalogOnce = false;
    throw new Error("catalog reload failed");
  }

  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};

  if (path === "/api/catalog" && method === "GET") return json(world.catalog);
  if (path === "/api/catalog" && method === "POST") {
    const created = entry({
      id: "movie:900",
      mediaId: 900,
      title: String(body.title ?? "New"),
      kind: (body.kind as CatalogEntry["kind"]) ?? "movie",
      completed: Boolean(body.completed),
      releaseYear: typeof body.releaseYear === "number" ? body.releaseYear : undefined,
    });
    world.catalog = [...world.catalog, created];
    return json(created);
  }
  if (path === "/api/catalog" && method === "PATCH") {
    world.catalog = world.catalog.map((item) => (item.id === body.id ? { ...item, title: String(body.title ?? item.title), completed: Boolean(body.completed) } : item));
    return json(world.catalog.find((item) => item.id === body.id) ?? world.catalog[0]);
  }
  if (path === "/api/catalog" && method === "DELETE") {
    const id = url.searchParams.get("id");
    world.catalog = world.catalog.filter((item) => item.id !== id);
    return json({});
  }
  if (path === "/api/auth" && method === "GET") return json(world.user ? { user: world.user } : {});
  if (path === "/api/auth" && method === "DELETE") {
    world.user = null;
    return json({});
  }
  if (path === "/api/auth" && method === "POST") {
    world.user = body.action === "register" || String(body.email ?? "").includes("bo@") ? { ...member, displayName: String(body.displayName || member.displayName) } : admin;
    if (String(body.email ?? "").includes("ada@")) world.user = admin;
    return json({ user: world.user });
  }
  if (path === "/api/auth" && method === "PATCH") {
    world.user = {
      ...(world.user ?? admin),
      displayName: String(body.displayName ?? world.user?.displayName ?? "Ada"),
      aboutMe: String(body.aboutMe ?? ""),
      ...(typeof body.avatar === "string" || body.avatar === null ? { avatar: String(body.avatar ?? "") } : {}),
    };
    return json({ user: world.user });
  }
  if (path === "/api/progress" && method === "GET") return json(world.progress);
  if (path === "/api/progress" && method === "PATCH") {
    if (world.nextProgress) {
      world.progress = world.nextProgress;
      world.nextProgress = undefined;
      return json(world.progress);
    }
    if ("score" in body && typeof body.id === "string") {
      if (body.score == null) delete world.progress.scores[body.id];
      else world.progress.scores[body.id] = Number(body.score);
    }
    if ("completed" in body && typeof body.id === "string") {
      const ids = new Set(world.progress.ids);
      if (body.completed) ids.add(body.id);
      else ids.delete(body.id);
      world.progress.ids = [...ids];
      if (body.dated === false && !world.progress.undatedIds.includes(body.id)) world.progress.undatedIds.push(body.id);
      if (typeof body.year === "number") world.progress.watchedYears[body.id] = body.year;
    }
    return json(world.progress);
  }
  if (path === "/api/lists" && method === "GET") return json({ lists: world.lists });
  if (path === "/api/lists" && method === "POST" && body.franchiseId) {
    const list = world.lists.find((item) => item.id === Number(body.listId));
    const franchise = world.franchises.find((item) => item.id === Number(body.franchiseId));
    if (list && franchise) list.items = [...new Set([...list.items, ...franchise.items])];
    return json({ lists: world.lists });
  }
  if (path === "/api/lists" && method === "POST" && body.itemId) {
    const list = world.lists.find((item) => item.id === Number(body.listId));
    if (list && !list.items.includes(String(body.itemId))) list.items.push(String(body.itemId));
    return json({ lists: world.lists });
  }
  if (path === "/api/lists" && method === "POST") {
    world.lists = [...world.lists, { id: 100 + world.lists.length, name: String(body.name ?? "List"), items: [], visibility: "private" }];
    return json({ lists: world.lists });
  }
  if (path === "/api/lists" && method === "PATCH" && body.visibility) {
    world.lists = world.lists.map((item) => (item.id === Number(body.id) ? { ...item, visibility: body.visibility === "public" ? "public" : "private" } : item));
    return json({ lists: world.lists });
  }
  if (path === "/api/lists" && method === "PATCH") {
    world.lists = world.lists.map((item) => (item.id === Number(body.id) ? { ...item, name: String(body.name ?? item.name) } : item));
    return json({ lists: world.lists });
  }
  if (path === "/api/lists" && method === "DELETE" && url.searchParams.has("franchiseId")) {
    const list = world.lists.find((item) => item.id === Number(url.searchParams.get("listId")));
    const franchise = world.franchises.find((item) => item.id === Number(url.searchParams.get("franchiseId")));
    if (list && franchise) list.items = list.items.filter((item) => !franchise.items.includes(item));
    return json({ lists: world.lists });
  }
  if (path === "/api/lists" && method === "DELETE" && url.searchParams.has("itemId")) {
    const list = world.lists.find((item) => item.id === Number(url.searchParams.get("listId")));
    if (list) list.items = list.items.filter((item) => item !== url.searchParams.get("itemId"));
    return json({ lists: world.lists });
  }
  if (path === "/api/lists" && method === "DELETE") {
    world.lists = world.lists.filter((item) => item.id !== Number(url.searchParams.get("id")));
    return json({ lists: world.lists });
  }
  if (path === "/api/franchises" && method === "GET") return json({ franchises: world.franchises });
  if (path === "/api/franchises" && method === "POST" && body.itemId) {
    const franchise = world.franchises.find((item) => item.id === Number(body.franchiseId));
    if (franchise && !franchise.items.includes(String(body.itemId))) franchise.items.push(String(body.itemId));
    return json({ franchises: world.franchises });
  }
  if (path === "/api/franchises" && method === "POST") {
    if (!world.reuseFranchiseIds) world.franchises = [...world.franchises, { id: 400 + world.franchises.length, name: String(body.name ?? "Franchise"), items: [] }];
    return json({ franchises: world.franchises });
  }
  if (path === "/api/franchises" && method === "PATCH") {
    world.franchises = world.franchises.map((item) => (item.id === Number(body.id) ? { ...item, name: String(body.name ?? item.name) } : item));
    return json({ franchises: world.franchises });
  }
  if (path === "/api/franchises" && method === "DELETE" && url.searchParams.has("itemId")) {
    const franchise = world.franchises.find((item) => item.id === Number(url.searchParams.get("franchiseId")));
    if (franchise) franchise.items = franchise.items.filter((item) => item !== url.searchParams.get("itemId"));
    return json({ franchises: world.franchises });
  }
  if (path === "/api/franchises" && method === "DELETE") {
    world.franchises = world.franchises.filter((item) => item.id !== Number(url.searchParams.get("id")));
    return json({ franchises: world.franchises });
  }
  if (path === "/api/upcoming") return json(world.upcoming);
  if (path === "/api/friends" && method === "GET") return json(world.friends);
  if (path === "/api/friends" && method === "DELETE") return json(world.friends);
  if (path === "/api/friends") return json(world.friends);
  if (path === "/api/people" && url.searchParams.has("q")) {
    return json({ people: String(url.searchParams.get("q")).includes("empty") ? [] : world.search });
  }
  if (path === "/api/people") {
    const person = personById(Number(url.searchParams.get("id")));
    return person ? json({ person }) : json({ error: "Missing" }, 404);
  }
  if (path === "/api/follows" && method === "POST") {
    const person = personById(Number(body.userId));
    return json({ person: { ...(person ?? world.people[0]), following: true } });
  }
  if (path === "/api/follows" && method === "DELETE") {
    const person = personById(Number(url.searchParams.get("id")));
    return json({ person: { ...(person ?? world.people[0]), following: false } });
  }
  if (path === "/api/shows" && method === "GET") {
    const showId = Number(String(url.searchParams.get("id") ?? "").split(":")[1]);
    return json(world.guides[showId] ?? { id: `show:${showId}`, showId, seasons: [] });
  }
  if (path === "/api/shows" && method === "PATCH") {
    const showId = typeof body.id === "string" ? Number(body.id.split(":")[1]) : 4;
    return json(world.guides[showId] ?? world.guides[4]);
  }
  if (path === "/api/watch") {
    if (world.watch.title === "") return json({ title: "" }, 200);
    return json(world.watch);
  }
  if (path === "/api/tmdb" && method === "GET") return json({ results: world.tmdb });
  if (path === "/api/tmdb" && method === "POST") return json({ id: world.importId });
  if (path === "/api/sync" && method === "GET") return json(world.sync);
  if (path === "/api/sync" && method === "POST") {
    if (world.horrorThrow !== undefined) {
      const error = world.horrorThrow;
      world.horrorThrow = undefined;
      throw error;
    }
    return json(world.horrorQueue.shift() ?? { import: body.import, done: true, added: 0, skipped: 0, batchAdded: 0, batchSkipped: 0, queued: 0, label: "idle" });
  }
  throw new Error(`unmocked ${method} ${url.pathname}${url.search}`);
}

function installBrowser(): void {
  standaloneMatch = false;
  navStandalone = false;
  window.matchMedia = ((query: string) => ({
    matches: standaloneMatch && query.includes("standalone"),
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false; },
  })) as typeof window.matchMedia;
  Object.defineProperty(navigator, "standalone", { configurable: true, get: () => navStandalone });
  Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => "Mozilla/5.0 HorrorVerseTest" });
  Object.defineProperty(navigator, "platform", { configurable: true, get: () => "Win32" });
  Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, get: () => 0 });
  Element.prototype.scrollIntoView = () => undefined;
  HTMLInputElement.prototype.setSelectionRange = () => undefined;
  HTMLCanvasElement.prototype.getContext = function getContext() {
    if (contextMode === "null") return null;
    return { drawImage() {} } as unknown as CanvasRenderingContext2D;
  };
  HTMLCanvasElement.prototype.toDataURL = () => dataUrl;
  vi.stubGlobal("createImageBitmap", async () => {
    if (bitmapMode === "throw-string") throw "nope";
    if (bitmapMode === "throw-error") throw new Error("nope");
    return { width: 400, height: 200, close() {} };
  });
  window.confirm = () => (confirms.length > 0 ? Boolean(confirms.shift()) : true);
  window.prompt = () => (prompts.length > 0 ? prompts.shift() ?? null : "Renamed");
  window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
    tracked.push({ target: window, type, listener });
    return originalWindowAdd(type, listener, options);
  }) as typeof window.addEventListener;
  document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
    tracked.push({ target: document, type, listener });
    return originalDocumentAdd(type, listener, options);
  }) as typeof document.addEventListener;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

async function boot(path = "/", reset = true): Promise<{ root: HTMLElement; mountApp: (root: HTMLElement) => void }> {
  if (reset) vi.resetModules();
  window.history.replaceState({}, "", path);
  const { mountApp } = await import("./app");
  const root = document.createElement("div");
  document.body.append(root);
  mountApp(root);
  await settle();
  return { root, mountApp };
}

function must<T extends Element>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`Missing ${selector}\n${"textContent" in root ? String(root.textContent).slice(0, 240) : ""}`);
  return found;
}

async function click(root: ParentNode, selector: string): Promise<void> {
  must<HTMLElement>(root, selector).click();
  await settle();
}

async function clickAction(root: ParentNode, action: string, attr?: string, value?: string): Promise<void> {
  const matches = [...root.querySelectorAll<HTMLElement>(`[data-action="${action}"]`)].filter((node) => !attr || node.getAttribute(attr) === value);
  const enabled = matches.find((node) => !(node instanceof HTMLButtonElement && node.disabled));
  const target = enabled ?? matches[0];
  if (!target) throw new Error(`Missing action ${action} ${attr ?? ""}=${value ?? ""}`);
  if (target instanceof HTMLButtonElement && target.disabled) {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  } else {
    target.click();
  }
  await settle();
}

async function inject(root: HTMLElement, attrs: Record<string, string>, force = false): Promise<void> {
  const button = document.createElement("button");
  for (const [name, value] of Object.entries(attrs)) button.setAttribute(name, value);
  root.append(button);
  if (force) button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  else button.click();
  await settle();
}

async function submit(root: ParentNode, selector: string, fields: Record<string, string> = {}, checks: string[] = []): Promise<void> {
  const form = must<HTMLFormElement>(root, selector);
  for (const [name, value] of Object.entries(fields)) {
    const field = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
    if (field) field.value = value;
  }
  for (const name of checks) {
    const box = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
    if (box) box.checked = true;
  }
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await settle();
}

async function submitHtml(root: HTMLElement, html: string): Promise<void> {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  const form = holder.querySelector("form");
  if (!form) throw new Error("missing injected form");
  root.append(form);
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await settle();
}

async function typeField(root: ParentNode, selector: string, value: string, selection: "null" | "range"): Promise<void> {
  const input = must<HTMLInputElement>(root, selector);
  input.value = value;
  const selected = selection === "range" ? 1 : null;
  Object.defineProperty(input, "selectionStart", { configurable: true, get: () => selected });
  Object.defineProperty(input, "selectionEnd", { configurable: true, get: () => selected });
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle();
}

function changeValue(root: ParentNode, selector: string, value: string): void {
  const input = must<HTMLInputElement | HTMLSelectElement>(root, selector);
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function changed(root: ParentNode, selector: string, value: string): Promise<void> {
  changeValue(root, selector, value);
  await settle();
}

function setFiles(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, "files", { configurable: true, value: files });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function shareMod() {
  return import("./share");
}

async function storyMod() {
  return import("./story");
}

beforeEach(() => {
  world = createWorld();
  gates.clear();
  oneShots.length = 0;
  confirms = [];
  prompts = [];
  bitmapMode = "ok";
  contextMode = "ok";
  dataUrl = "data:image/jpeg;base64,abc";
  document.body.innerHTML = "";
  installBrowser();
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => handle(String(input), init));
});

afterEach(() => {
  for (const item of tracked) {
    if (item.target === window) originalWindowRemove(item.type, item.listener);
    else originalDocumentRemove(item.type, item.listener);
  }
  tracked.length = 0;
  window.addEventListener = originalWindowAdd;
  document.addEventListener = originalDocumentAdd;
  document.body.innerHTML = "";
});

describe("mountApp", () => {
  it("walks the signed-in vault", async () => {
    const { root } = await boot("/");
    expect(root.textContent).toContain("HorrorVerse");
    expect(root.textContent).toContain("Scream");

    await click(root, '[data-action="view"][data-view="stats"]');
    await clickAction(root, "stat-open", "data-filter", "movie");
    await click(root, '[data-action="view"][data-view="home"]');
    await clickAction(root, "recent-kind", "data-kind", "movie");
    await clickAction(root, "recent-kind", "data-kind", "podcast");
    await clickAction(root, "recent-kind", "data-kind", "all");
    await inject(root, { "data-action": "recent-kind", "data-kind": "series" });
    await inject(root, { "data-action": "recent-kind", "data-kind": "nope" });
    await clickAction(root, "open-badge", "data-badge", "first-blood");
    await clickAction(root, "stat-open");
    await click(root, '[data-action="view"][data-view="home"]');
    await clickAction(root, "open-badge", "data-badge", "the-curator");
    const listsCredit = [...root.querySelectorAll<HTMLElement>("[data-action='view'][data-view='lists']")].at(-1);
    listsCredit?.click();
    await settle();
    await click(root, '[data-action="view"][data-view="home"]');
    await clickAction(root, "open-badge", "data-badge", "franchise-killer");
    await clickAction(root, "stat-open", "data-franchises", "1");
    await click(root, '[data-action="view"][data-view="home"]');
    await inject(root, { "data-action": "open-badge", "data-badge": "missing" });
    await inject(root, { "data-action": "close-badge" });
    await click(root, ".dock-btn span");
    root.querySelector("h1")?.click();
    await settle();

    await click(root, '[data-action="view"][data-view="upcoming"]');
    await clickAction(root, "upcoming-pane", "data-pane", "shows");
    await clickAction(root, "upcoming-pane", "data-pane", "films");
    await inject(root, { "data-action": "upcoming-pane", "data-pane": "other" });
    await clickAction(root, "toggle-upcoming-month");
    await clickAction(root, "toggle-upcoming-month");
    await inject(root, { "data-action": "toggle-upcoming-month" });
    const next = root.querySelector<HTMLButtonElement>('[data-action="library-page"][data-page="2"]');
    next?.click();
    await settle();
    await clickAction(root, "library-page", "data-page", "1");

    await click(root, '[data-action="view"][data-view="home"]');
    await click(root, '[data-action="view"][data-view="library"][data-filter="movie"]');
    await typeField(root, "[data-library-search]", "scream", "range");
    await typeField(root, "[data-library-search]", "scream", "null");
    await clickAction(root, "clear-search");
    await submit(root, "[data-library-search-form]");
    await changed(root, '[data-library-kind][value="all"]', "all");
    await changed(root, '[data-library-kind][value="show"]', "show");
    await inject(root, { "data-action": "filter", "data-filter": "podcast" });
    await clickAction(root, "filter-tag", "data-tag", "slasher");
    await clickAction(root, "filter-tag", "data-tag", "");
    await inject(root, { "data-action": "filter-tag", "data-tag": "nope" });
    await clickAction(root, "filter", "data-filter", "book");
    await inject(root, { "data-action": "filter", "data-filter": "all" });
    await typeField(root, "[data-library-search]", "zzzz-no-match", "range");
    await clickAction(root, "clear-search");
    await clickAction(root, "filter-tag", "data-tag", "slasher");
    await typeField(root, "[data-library-search]", "zzzz-no-match", "null");
    await clickAction(root, "clear-search");
    await clickAction(root, "filter-tag", "data-tag", "");

    await clickAction(root, "toggle-kind", "data-kind", "movie");
    await clickAction(root, "toggle-kind", "data-kind", "movie");
    await inject(root, { "data-action": "toggle-kind", "data-kind": "nope" });
    await clickAction(root, "toggle-franchises");
    await clickAction(root, "toggle-franchise", "data-franchise-id", "1");
    await clickAction(root, "toggle-franchise", "data-franchise-id", "1");
    await inject(root, { "data-action": "toggle-franchise", "data-franchise-id": "nope" });
    await clickAction(root, "toggle-series", "data-series-id", "10");
    world.sync = { added: 1, postersFilled: 0 };
    await inject(root, { "data-action": "toggle-series", "data-series-id": "11" });
    world.down.add("/api/franchises");
    world.sync = { added: 0, postersFilled: 2 };
    await clickAction(root, "toggle-series", "data-series-id", "14");
    world.down.delete("/api/franchises");
    world.down.add("/api/progress");
    world.sync = { added: 2, postersFilled: 1 };
    await clickAction(root, "toggle-series", "data-series-id", "15");
    world.down.delete("/api/progress");
    world.sync = { added: 1, postersFilled: 1 };
    failNext("GET /api/sync", "status");
    await clickAction(root, "toggle-series", "data-series-id", "10");
    await inject(root, { "data-action": "toggle-series", "data-series-id": "1.5" });
    await clickAction(root, "toggle-franchise", "data-franchise-id", "1");
    await clickAction(root, "toggle-franchise-series", "data-series-id", "10");
    await clickAction(root, "toggle-franchise-series", "data-series-id", "10");
    await inject(root, { "data-action": "toggle-franchise-series" });

    await clickAction(root, "toggle-show", "data-show-id", "4");
    await clickAction(root, "toggle-show-season", "data-season-number", "1");
    await clickAction(root, "toggle-episode", "data-episode-id", "11");
    await clickAction(root, "toggle-episode", "data-episode-id", "10");
    await clickAction(root, "toggle-season", "data-season-id", "1");
    await clickAction(root, "toggle-season", "data-season-id", "2");
    await clickAction(root, "toggle-show-season", "data-season-number", "2");
    await clickAction(root, "toggle-show-season", "data-season-number", "3");
    await clickAction(root, "open-when-episode", "data-episode-id", "11");
    await clickAction(root, "when-now");
    await clickAction(root, "open-when-episode", "data-episode-id", "10");
    await clickAction(root, "when-undated");
    await clickAction(root, "open-when-episode", "data-episode-id", "11");
    await submit(root, "[data-when-year]", { year: "2018" });
    failNext("PATCH /api/shows", "status");
    await clickAction(root, "open-when-episode", "data-episode-id", "11");
    await clickAction(root, "when-now");
    failNext("PATCH /api/shows", "boom");
    await clickAction(root, "toggle-episode", "data-episode-id", "11");
    await clickAction(root, "toggle-show", "data-show-id", "5");
    await clickAction(root, "toggle-show", "data-show-id", "6");
    failNext("GET /api/shows", "status");
    await clickAction(root, "toggle-show", "data-show-id", "5");
    await inject(root, { "data-action": "toggle-show", "data-show-id": "nope" });
    await inject(root, { "data-action": "toggle-show-season", "data-show-id": "4", "data-season-number": "nope" });
    await inject(root, { "data-action": "toggle-episode" });
    await inject(root, { "data-action": "toggle-season" });
    await inject(root, { "data-action": "open-when-episode", "data-show-id": "4", "data-episode-id": "999" });

    await inject(root, { "data-action": "set-score", "data-id": "movie:3", "data-score": "3" });
    await clickAction(root, "toggle", "data-id", "movie:3");
    await clickAction(root, "toggle", "data-id", "show:5");
    await clickAction(root, "set-score", "data-id", "movie:1");
    const scoreFive = [...root.querySelectorAll<HTMLElement>('[data-action="set-score"][data-id="movie:1"]')].find((node) => node.dataset.score === "5");
    scoreFive?.click();
    await settle();
    const scoreFour = [...root.querySelectorAll<HTMLElement>('[data-action="set-score"][data-id="movie:1"]')].find((node) => node.dataset.score === "4");
    scoreFour?.click();
    await settle();
    await inject(root, { "data-action": "set-score", "data-id": "movie:1", "data-score": "0" });
    await inject(root, { "data-action": "set-score", "data-id": "movie:1", "data-score": "6" });
    await inject(root, { "data-action": "set-score", "data-id": "missing", "data-score": "3" });
    await inject(root, { "data-action": "toggle", "data-id": "missing" });
    failNext("PATCH /api/progress", "status");
    await clickAction(root, "toggle", "data-id", "movie:80");
    failNext("PATCH /api/progress", "boom");
    await clickAction(root, "set-score", "data-id", "movie:1");

    await clickAction(root, "open-when", "data-id", "movie:3");
    await clickAction(root, "when-now");
    await clickAction(root, "open-when", "data-id", "show:6");
    await clickAction(root, "when-undated");
    await clickAction(root, "open-when", "data-id", "book:7");
    await submit(root, "[data-when-year]", { year: "1991" });
    await inject(root, { "data-action": "library-page", "data-page-key": "kind:movie", "data-page": "2" });
    await clickAction(root, "open-when", "data-id", "movie:70");
    await clickAction(root, "close-when");
    await inject(root, { "data-action": "library-page", "data-page-key": "kind:movie", "data-page": "1" });
    await inject(root, { "data-action": "open-when", "data-id": "missing" });
    await inject(root, { "data-action": "when-now" });
    await submitHtml(root, `<form data-when-year><input name="year" value="abc" /></form>`);

    await clickAction(root, "open-watch", "data-id", "movie:1");
    await clickAction(root, "close-watch");
    await clickAction(root, "open-watch", "data-id", "movie:1");
    world.watch = { title: "Cropsey", region: "", streaming: [], free: [], rent: [], buy: [], attribution: "JustWatch", link: "https://www.themoviedb.org/movie/6" };
    await clickAction(root, "open-watch", "data-id", "documentary:6");
    world.watch = { title: "Zone", region: "US", streaming: [], free: [], rent: [], buy: [], attribution: "" };
    await clickAction(root, "close-watch");
    await clickAction(root, "open-watch", "data-id", "show:4");
    failNext("GET /api/watch", "status");
    await clickAction(root, "close-watch");
    await inject(root, { "data-action": "library-page", "data-page-key": "kind:movie", "data-page": "2" });
    await clickAction(root, "open-watch", "data-id", "movie:70");
    failNext("GET /api/watch", "boom");
    await clickAction(root, "close-watch");
    await inject(root, { "data-action": "library-page", "data-page-key": "kind:movie", "data-page": "1" });
    await clickAction(root, "open-watch", "data-id", "documentary:6");
    await inject(root, { "data-action": "open-watch", "data-id": "book:7" });
    await clickAction(root, "close-watch");

    const share = await shareMod();
    const story = await storyMod();
    vi.mocked(share.shareStoryImage).mockResolvedValueOnce("saved");
    await clickAction(root, "share-title", "data-id", "movie:1");
    vi.mocked(share.shareStoryImage).mockResolvedValueOnce("shared");
    await clickAction(root, "share-title", "data-id", "podcast:32");
    vi.mocked(story.renderTitleStoryCard).mockRejectedValueOnce(new Error("draw failed"));
    await inject(root, { "data-action": "library-page", "data-page-key": "kind:movie", "data-page": "2" });
    await clickAction(root, "share-title", "data-id", "movie:70");
    await inject(root, { "data-action": "library-page", "data-page-key": "kind:movie", "data-page": "1" });
    vi.mocked(story.renderTitleStoryCard).mockRejectedValueOnce("draw failed");
    await clickAction(root, "share-title", "data-id", "book:7");
    vi.mocked(story.renderRecapStoryCard).mockResolvedValueOnce(new Blob(["r"]));
    vi.mocked(share.shareStoryImage).mockResolvedValueOnce("saved");
    await click(root, '[data-action="view"][data-view="account"]');
    await clickAction(root, "share-recap");
    await click(root, '[data-action="view"][data-view="library"]');
    await inject(root, { "data-action": "share-title", "data-id": "movie:3" });
    await inject(root, { "data-action": "share-title", "data-id": "missing" });

    await clickAction(root, "open-lists", "data-id", "movie:1");
    await clickAction(root, "toggle-list-item", "data-list-id", "2");
    await clickAction(root, "toggle-list-item", "data-list-id", "1");
    await submit(root, "[data-list-form]", { name: "Favorites" });
    failNext("POST /api/lists", "status");
    await submit(root, "[data-list-form]", { name: "Bad" });
    await clickAction(root, "close-lists");
    await clickAction(root, "open-lists", "data-id", "series:10");
    await clickAction(root, "close-lists");
    await inject(root, { "data-action": "open-lists", "data-id": "missing" });
    await inject(root, { "data-action": "toggle-list-item", "data-list-id": "1" });
    await inject(root, { "data-action": "toggle-list-item", "data-list-id": "999", "data-id": "movie:1" });

    await clickAction(root, "open-franchise-lists", "data-franchise-id", "2");
    await clickAction(root, "toggle-franchise-list", "data-franchise-id", "2");
    const otherList = [...root.querySelectorAll<HTMLElement>('[data-action="toggle-franchise-list"][data-franchise-id="2"]')].find((node) => node.dataset.listId === "5");
    otherList?.click();
    await settle();
    await inject(root, { "data-action": "toggle-franchise-list", "data-list-id": "1", "data-franchise-id": "3" });
    await clickAction(root, "close-lists");
    await inject(root, { "data-action": "open-franchise-lists", "data-franchise-id": "3" });
    await inject(root, { "data-action": "open-franchise-lists", "data-franchise-id": "999" });

    await clickAction(root, "open-franchises", "data-id", "series:10");
    await clickAction(root, "toggle-franchise-item", "data-franchise-id", "2");
    await clickAction(root, "toggle-franchise-item", "data-franchise-id", "2");
    world.reuseFranchiseIds = true;
    await submit(root, "[data-franchise-form]", { name: "Existing" });
    world.reuseFranchiseIds = false;
    failNext("POST /api/franchises", "status");
    await submit(root, "[data-franchise-form]", { name: "Broken" });
    failNext("POST /api/franchises", "boom");
    await submit(root, "[data-franchise-form]", { name: "Broken again" });
    await clickAction(root, "close-franchises");
    await clickAction(root, "open-franchises", "data-id", "movie:3");
    await clickAction(root, "close-franchises");
    await inject(root, { "data-action": "open-franchises", "data-id": "podcast:31" });
    await inject(root, { "data-action": "open-franchises", "data-id": "missing" });
    await inject(root, { "data-action": "toggle-franchise-item", "data-franchise-id": "1" });

    await clickAction(root, "open-franchise-add", "data-franchise-id", "1");
    await typeField(root, "[data-franchise-search]", "scream", "range");
    await typeField(root, "[data-franchise-search]", "", "null");
    await changed(root, '[data-franchise-kind][value="movie"]', "movie");
    await changed(root, '[data-franchise-kind][value="book"]', "book");
    await clickAction(root, "toggle-franchise-item");
    await typeField(root, "[data-franchise-search]", "zzzz-none", "range");
    await clickAction(root, "close-franchises");
    await inject(root, { "data-action": "open-franchise-add", "data-franchise-id": "999" });
    await clickAction(root, "remove-franchise-item", "data-franchise-id", "1");
    prompts = [null];
    await clickAction(root, "rename-franchise", "data-franchise-id", "1");
    prompts = ["Renamed Saga"];
    await clickAction(root, "rename-franchise", "data-franchise-id", "1");
    confirms = [false];
    await clickAction(root, "delete-franchise", "data-franchise-id", "5");
    confirms = [true];
    failNext("DELETE /api/franchises", "status");
    await clickAction(root, "delete-franchise", "data-franchise-id", "5");
    await submit(root, "[data-franchise-form]", { name: "Fresh Franchise" });
    failNext("POST /api/franchises", "status");
    await submit(root, "[data-franchise-form]", { name: "No Franchise" });

    await click(root, '[data-action="open-add"]');
    await changed(root, "[data-sheet-kind]", "podcast");
    await changed(root, "[data-sheet-kind]", "book");
    await submit(root, "[data-tmdb-form]", { q: "it" });
    world.tmdb = [];
    await submit(root, "[data-tmdb-form]", { q: "empty" });
    world.tmdb = createWorld().tmdb;
    failNext("GET /api/tmdb", "status");
    await submit(root, "[data-tmdb-form]", { q: "boom" });
    failNext("GET /api/tmdb", "boom");
    await submit(root, "[data-tmdb-form]", { q: "ab" });
    await inject(root, { "data-action": "import-tmdb", "data-source-id": "nope", "data-tmdb-id": "" });
    world.importId = "book:7";
    await submit(root, "[data-tmdb-form]", { q: "it" });
    await clickAction(root, "import-tmdb", "data-source-id", "OL12W");
    await click(root, '[data-action="open-add"]');
    await changed(root, "[data-sheet-kind]", "game");
    await submit(root, "[data-tmdb-form]", { q: "resident" });
    await inject(root, { "data-action": "import-tmdb", "data-source-id": "12a", "data-tmdb-id": "" });
    world.importId = "game:33";
    await clickAction(root, "import-tmdb", "data-source-id", "99");
    await click(root, '[data-action="open-add"]');
    await changed(root, "[data-sheet-kind]", "movie");
    await submit(root, "[data-tmdb-form]", { q: "scream" });
    await inject(root, { "data-action": "import-tmdb", "data-tmdb-id": "nope", "data-source-id": "" });
    failNext("POST /api/tmdb", "status");
    await clickAction(root, "import-tmdb", "data-tmdb-id", "55");
    failNext("POST /api/tmdb", "boom");
    await submit(root, "[data-tmdb-form]", { q: "scream" });
    await clickAction(root, "import-tmdb", "data-tmdb-id", "55");
    world.down.add("/api/franchises");
    await click(root, '[data-action="open-add"]');
    await submit(root, "[data-catalog-form]", { title: "Typed Film", releaseYear: "1996" }, ["completed"]);
    world.down.delete("/api/franchises");
    world.down.add("/api/lists");
    await click(root, '[data-action="open-add"]');
    await submit(root, "[data-catalog-form]", { title: "No Year", releaseYear: "" });
    world.down.delete("/api/lists");
    await click(root, '[data-action="open-add"]');
    await submit(root, "[data-catalog-form]", { title: "Bad Year", releaseYear: "0" });
    failNext("POST /api/catalog", "status");
    await click(root, '[data-action="open-add"]');
    await submit(root, "[data-catalog-form]", { title: "Failed" });
    await click(root, '[data-action="open-add"]');
    await changed(root, "[data-sheet-kind]", "show");
    await changed(root, "[data-sheet-kind]", "series");
    await changed(root, "[data-sheet-kind]", "documentary");
    await changed(root, "[data-sheet-kind]", "game");
    await clickAction(root, "close-sheet");

    await typeField(root, "[data-library-search]", "scream", "range");
    await clickAction(root, "open-tmdb");
    world.importId = "missing:1";
    await clickAction(root, "import-tmdb", "data-tmdb-id", "55");
    await inject(root, { "data-action": "close-lists" });
    world.importId = "show:4";
    failNext("GET /api/shows", "status");
    await clickAction(root, "open-tmdb");
    await clickAction(root, "import-tmdb", "data-tmdb-id", "55");
    await clickAction(root, "close-lists");
    world.importId = "show:5";
    await clickAction(root, "open-tmdb");
    await clickAction(root, "import-tmdb", "data-tmdb-id", "55");
    await clickAction(root, "close-lists");
    await clickAction(root, "clear-search");
    await clickAction(root, "open-tmdb");
    await clickAction(root, "close-sheet");

    await clickAction(root, "open-edit", "data-id", "book:7");
    await submit(root, "[data-catalog-form]", { title: "It Returns" }, ["completed"]);
    await submitHtml(root, `<form data-catalog-form="edit"><input name="title" value="No kind" /></form>`);
    failNext("PATCH /api/catalog", "boom");
    await clickAction(root, "open-edit", "data-id", "movie:1");
    await submit(root, "[data-catalog-form]", { title: "Scream" });
    await inject(root, { "data-action": "open-edit", "data-id": "missing" });
    confirms = [false];
    await inject(root, { "data-action": "library-page", "data-page-key": "kind:movie", "data-page": "2" });
    await clickAction(root, "delete", "data-id", "movie:84");
    confirms = [true];
    failNext("DELETE /api/catalog", "status");
    await clickAction(root, "delete", "data-id", "movie:84");
    confirms = [true];
    await clickAction(root, "delete", "data-id", "movie:83");

    await inject(root, { "data-action": "library-page", "data-page-key": "kind:movie", "data-page": "9" });
    await inject(root, { "data-action": "library-page", "data-page-key": "missing", "data-page": "1" });
    await inject(root, { "data-action": "library-page", "data-page-key": "", "data-page": "1" });
    await inject(root, { "data-action": "library-page", "data-page-key": "kind:movie", "data-page": "0" });
    await inject(root, { "data-action": "library-page", "data-page-key": "kind:movie", "data-page": "1.5" });
    await inject(root, { "data-action": "stat-open", "data-filter": "nope", "data-tag": "nope", "data-query": "Scream" });
    await inject(root, { "data-action": "stat-open", "data-filter": "all", "data-tag": "zombie", "data-franchises": "1" });
    await click(root, '[data-action="view"][data-view="home"]');
    await inject(root, { "data-action": "clear-search" });
    const stray = document.createElement("input");
    stray.dataset.librarySearch = "";
    root.append(stray);
    stray.value = "home";
    stray.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    const kind = document.createElement("input");
    kind.dataset.libraryKind = "";
    kind.value = "nope";
    root.append(kind);
    kind.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    const franchiseKind = document.createElement("input");
    franchiseKind.dataset.franchiseKind = "";
    franchiseKind.value = "movie";
    root.append(franchiseKind);
    franchiseKind.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    franchiseKind.value = "nope";
    franchiseKind.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    root.dispatchEvent(new Event("input", { bubbles: true }));
    root.dispatchEvent(new Event("change", { bubbles: true }));
    root.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await settle();

    await click(root, '[data-action="view"][data-view="lists"]');
    await clickAction(root, "list-visibility", "data-list-id", "1");
    await clickAction(root, "list-visibility", "data-list-id", "2");
    prompts = [null];
    await clickAction(root, "rename-list", "data-list-id", "1");
    prompts = ["October renamed"];
    await clickAction(root, "rename-list", "data-list-id", "1");
    confirms = [false];
    await clickAction(root, "delete-list", "data-list-id", "4");
    confirms = [true];
    failNext("DELETE /api/lists", "boom");
    await clickAction(root, "delete-list", "data-list-id", "4");
    await clickAction(root, "toggle-list-series", "data-series-id", "10");
    await clickAction(root, "toggle-list-series", "data-series-id", "10");
    await inject(root, { "data-action": "toggle-list-series" });
    await inject(root, { "data-action": "list-visibility", "data-list-id": "999" });
    failNext("GET /api/shows", "boom");
    await clickAction(root, "toggle-show", "data-show-id", "6");
    failNext("PATCH /api/lists", "status");
    await clickAction(root, "toggle-list-item", "data-list-id", "5");
    await submit(root, "[data-list-form]", { name: "From lists" });
    await inject(root, { "data-action": "open-lists", "data-id": "movie:3" });
    failNext("POST /api/lists", "boom");
    await clickAction(root, "toggle-list-item", "data-list-id", "5");
    await clickAction(root, "close-lists");
    await inject(root, { "data-action": "open-franchise-lists", "data-franchise-id": "5" });
    failNext("POST /api/lists", "status");
    await clickAction(root, "toggle-franchise-list");
    await clickAction(root, "close-lists");

    await click(root, '[data-action="view"][data-view="account"]');
    failNext("GET /api/friends", "status");
    await click(root, '[data-action="view"][data-view="home"]');
    await click(root, '[data-action="view"][data-view="account"]');
    failNext("GET /api/friends", "boom");
    await click(root, '[data-action="view"][data-view="library"]');
    await click(root, '[data-action="view"][data-view="account"]');
    await submit(root, "[data-people-search]", { query: "eve" });
    await submit(root, "[data-people-search]", { query: "empty" });
    failNext("GET /api/people", "status");
    await submit(root, "[data-people-search]", { query: "eve" });
    failNext("GET /api/people", "boom");
    await submit(root, "[data-people-search]", { query: "eve" });
    await submit(root, "[data-people-search]", { query: "eve" });
    await clickAction(root, "friend-request", "data-user-id", "5");
    failNext("POST /api/friends", "status");
    await clickAction(root, "friend-request", "data-user-id", "5");
    failNext("POST /api/friends", "boom");
    await clickAction(root, "friend-respond", "data-respond", "accept");
    await clickAction(root, "friend-respond", "data-respond", "decline");
    await clickAction(root, "friend-respond", "data-respond", "cancel");
    await inject(root, { "data-action": "friend-respond", "data-respond": "other", "data-user-id": "3" });
    confirms = [false];
    await clickAction(root, "unfriend", "data-user-id", "7");
    confirms = [true];
    await clickAction(root, "unfriend", "data-user-id", "7");
    await clickAction(root, "follow-person", "data-user-id", "5");
    await clickAction(root, "unfollow-person", "data-user-id", "6");
    failNext("GET /api/people", "status");
    await clickAction(root, "follow-person", "data-user-id", "6");
    await clickAction(root, "open-person", "data-user-id", "1");
    await clickAction(root, "open-person", "data-user-id", "7");
    await inject(root, { "data-action": "follow-person", "data-user-id": "7" });
    await click(root, '[data-action="view"][data-view="account"]');
    await inject(root, { "data-action": "open-person", "data-user-id": "8" });
    await click(root, '[data-action="view"][data-view="account"]');
    await clickAction(root, "open-person", "data-user-id", "6");
    await click(root, '[data-action="view"][data-view="account"]');
    await inject(root, { "data-action": "open-person", "data-user-id": "9" });
    failNext("GET /api/people", "status");
    await click(root, '[data-action="view"][data-view="account"]');
    await inject(root, { "data-action": "open-person", "data-user-id": "8" });
    failNext("GET /api/people", "boom");
    await inject(root, { "data-action": "open-person", "data-user-id": "404" });
    await inject(root, { "data-action": "open-person", "data-user-id": "0" });
    await inject(root, { "data-action": "open-person", "data-user-id": "1.5" });
    await inject(root, { "data-action": "friend-request", "data-user-id": "nope" });
    await inject(root, { "data-action": "friend-respond", "data-user-id": "nope" });
    await inject(root, { "data-action": "unfriend", "data-user-id": "nope" });
    await inject(root, { "data-action": "follow-person", "data-user-id": "nope" });
    await inject(root, { "data-action": "unfollow-person", "data-user-id": "nope" });

    const avatar = must<HTMLInputElement>(root, "[data-avatar-input]");
    setFiles(avatar, []);
    await settle();
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 9 * 1024 * 1024 });
    setFiles(must(root, "[data-avatar-input]"), [big]);
    await settle();
    bitmapMode = "throw-string";
    setFiles(must(root, "[data-avatar-input]"), [new File(["x"], "a.png", { type: "image/png" })]);
    await settle();
    bitmapMode = "throw-error";
    setFiles(must(root, "[data-avatar-input]"), [new File(["x"], "a.png", { type: "image/png" })]);
    await settle();
    bitmapMode = "ok";
    contextMode = "null";
    setFiles(must(root, "[data-avatar-input]"), [new File(["x"], "a.png", { type: "image/png" })]);
    await settle();
    contextMode = "ok";
    dataUrl = "x".repeat(120_001);
    setFiles(must(root, "[data-avatar-input]"), [new File(["x"], "a.png", { type: "image/png" })]);
    await settle();
    dataUrl = "data:image/jpeg;base64,abc";
    setFiles(must(root, "[data-avatar-input]"), [new File(["x"], "a.png", { type: "image/png" })]);
    await settle();
    await submit(root, "[data-profile-form]", { displayName: "Ada", aboutMe: "Still here" });
    await submit(root, "[data-profile-form]", { displayName: "Ada", aboutMe: "Again" });
    failNext("PATCH /api/auth", "status");
    await submit(root, "[data-profile-form]", { displayName: "Ada", aboutMe: "Nope" });
    failNext("PATCH /api/auth", "boom");
    await submit(root, "[data-profile-form]", { displayName: "Ada", aboutMe: "Nope" });

    world.failCatalogOnce = true;
    await clickAction(root, "import-horror-films");
    await clickAction(root, "import-horror-collections");
    world.horrorThrow = new Error("Import failed badly");
    await clickAction(root, "import-horror-films");
    world.horrorThrow = "offline";
    await clickAction(root, "import-horror-collections");
    world.horrorQueue = [{ import: "horror-films", done: false, added: 1, skipped: 0, batchAdded: 0, batchSkipped: 0, queued: 2, label: "paused" }];
    arm("POST /api/sync");
    void clickAction(root, "import-horror-films");
    await untilWaiting("POST /api/sync");
    await clickAction(root, "stop-horror-import");
    await inject(root, { "data-action": "import-horror-collections" }, true);
    gates.get("POST /api/sync")?.release();
    await settle();

    world.nextProgress = { ...world.progress, ids: world.progress.ids, watchedYears: { "missing:1": 1999 } };
    await click(root, '[data-action="view"][data-view="library"]');
    await inject(root, { "data-action": "filter-tag", "data-tag": "" });
    await inject(root, { "data-action": "toggle", "data-id": "movie:80" });
    await click(root, '[data-action="view"][data-view="home"]');
    const whenBadge = root.querySelector<HTMLElement>('[data-action="open-badge"][data-badge="when-it-happened"]');
    if (whenBadge) {
      whenBadge.click();
      await settle();
      await clickAction(root, "close-badge");
    }
    await clickAction(root, "open-badge", "data-badge", "first-blood");
    world.nextProgress = { ...world.progress, ids: [], watchedYears: {}, scores: {}, recentIds: [], undatedIds: [] };
    await click(root, '[data-action="view"][data-view="library"]');
    await inject(root, { "data-action": "toggle", "data-id": "movie:1" });

    await click(root, '[data-action="view"][data-view="account"]');
    await clickAction(root, "logout");
    expect(root.textContent).toContain("Sign in");
  }, 120_000);

  it("covers guests, registration, and members", async () => {
    world.user = null;
    const { root } = await boot("/library?kind=book&q=it&tag=vampire&franchises=1");
    await clickAction(root, "toggle", "data-id", "movie:1");
    await click(root, '[data-action="view"][data-view="library"]');
    await clickAction(root, "open-tmdb");
    await click(root, '[data-action="view"][data-view="library"]');
    await inject(root, { "data-action": "open-lists", "data-id": "movie:1" });
    await inject(root, { "data-action": "open-watch", "data-id": "movie:1" });
    await inject(root, { "data-action": "open-franchise-lists", "data-franchise-id": "2" });
    await inject(root, { "data-action": "toggle-episode", "data-episode-id": "10" });
    await inject(root, { "data-action": "toggle-season", "data-season-id": "1" });
    await inject(root, { "data-action": "toggle-show", "data-show-id": "4" });
    await inject(root, { "data-action": "toggle-show-season", "data-show-id": "nope", "data-season-number": "1" });
    await inject(root, { "data-action": "toggle-show-season", "data-show-id": "4", "data-season-number": "1" });
    await click(root, '[data-action="view"][data-view="library"]');
    await clickAction(root, "clear-search");
    await clickAction(root, "filter-tag", "data-tag", "");
    await changed(root, '[data-library-kind][value="movie"]', "movie");
    await clickAction(root, "toggle-series", "data-series-id", "10");
    await clickAction(root, "toggle-franchise-series", "data-series-id", "10");
    await inject(root, { "data-action": "share-title", "data-id": "movie:1" });
    await inject(root, { "data-action": "share-recap" });
    await inject(root, { "data-action": "open-person", "data-user-id": "7" });
    await inject(root, { "data-action": "friend-request", "data-user-id": "5" });
    await inject(root, { "data-action": "import-horror-films" });
    await inject(root, { "data-action": "open-add" });
    await inject(root, { "data-action": "open-edit", "data-id": "movie:1" });
    await inject(root, { "data-action": "delete", "data-id": "movie:1" });
    await inject(root, { "data-action": "import-tmdb", "data-tmdb-id": "5", "data-source-id": "OL1W" });
    await submitHtml(root, `<form data-people-search><input name="query" value="eve" /></form>`);
    await submitHtml(root, `<form data-list-form><input name="name" value="Nope" /></form>`);
    await submitHtml(root, `<form data-franchise-form><input name="name" value="Nope" /></form>`);
    await submitHtml(root, `<form data-profile-form><input name="displayName" value="Nope" /></form>`);
    await submitHtml(root, `<form data-catalog-form><input name="title" value="Nope" /></form>`);
    await click(root, '[data-action="view"][data-view="lists"]');
    await click(root, '[data-action="view"][data-view="home"]');
    await click(root, '[data-action="view"][data-view="stats"]');
    await click(root, '[data-action="view"][data-view="account"]');
    await clickAction(root, "auth-mode", "data-mode", "register");
    await clickAction(root, "auth-mode", "data-mode", "login");
    arm("POST /api/auth");
    void submit(root, "[data-auth-form]", { email: "ada@vault.test", password: "secretsecret" });
    await untilWaiting("POST /api/auth");
    await submit(root, "[data-auth-form]", { email: "ada@vault.test", password: "secretsecret" });
    gates.get("POST /api/auth")?.release();
    await settle();
    await clickAction(root, "logout");
    failNext("POST /api/auth", "status");
    await submit(root, "[data-auth-form]", { email: "ada@vault.test", password: "secretsecret" });
    failNext("POST /api/auth", "boom");
    await submit(root, "[data-auth-form]", { email: "ada@vault.test", password: "secretsecret" });
    await clickAction(root, "auth-mode", "data-mode", "register");
    await submit(root, "[data-auth-form]", { email: "bo@vault.test", password: "secretsecret", displayName: "Bo" });
    expect(root.textContent).toContain("Member");
    await click(root, '[data-action="view"][data-view="library"]');
    await clickAction(root, "open-tmdb");
    await clickAction(root, "close-sheet");
    await click(root, '[data-action="view"][data-view="lists"]');
    await submit(root, "[data-list-form]", { name: "Member list" });
    await click(root, '[data-action="view"][data-view="account"]');
    await clickAction(root, "logout");
  }, 60_000);

  it("covers load failures, sync, empty copy, and history", async () => {
    world.down.add("/api/catalog");
    world.down.add("/api/upcoming");
    world.down.add("/api/friends");
    world.downMode = "status";
    let booted = await boot("/");
    await clickAction(booted.root, "reload");
    world.down.delete("/api/catalog");
    await clickAction(booted.root, "reload");

    world = createWorld();
    world.down.add("/api/upcoming");
    world.downMode = "string";
    booted = await boot("/upcoming");
    expect(booted.root.textContent).toContain("Could not load upcoming titles.");

    world = createWorld();
    world.down.add("/api/progress");
    booted = await boot("/");
    expect(booted.root.textContent).toContain("Ada");

    world = createWorld();
    world.sync = { added: 3, postersFilled: 1 };
    booted = await boot("/");
    expect(booted.root.textContent).toContain("Scream");

    world = createWorld();
    world.sync = { added: 1, postersFilled: 0 };
    world.down.add("/api/franchises");
    world.down.add("/api/lists");
    await boot("/");

    world = createWorld();
    world.sync = { added: 1, postersFilled: 0 };
    world.down.add("/api/sync");
    world.downMode = "string";
    await boot("/");

    world = createWorld();
    world.upcoming = { films: [], shows: [] };
    booted = await boot("/upcoming");
    await clickAction(booted.root, "upcoming-pane", "data-pane", "shows");

    world = createWorld();
    world.upcoming = {
      films: [{ kind: "film", tmdbId: 1, title: "Only today", releaseDate: TODAY }],
      shows: [],
    };
    await boot("/upcoming");

    world = createWorld();
    world.catalog = [entry({ id: "podcast:1", mediaId: 1, title: "Only Cast", kind: "podcast", completed: false })];
    world.franchises = [];
    world.lists = [];
    world.progress = { ...world.progress, ids: [], recentIds: [], watchedYears: {}, scores: {}, watchNext: [], readNext: [] };
    world.user = { ...admin, displayName: " ", avatar: undefined, aboutMe: undefined };
    booted = await boot("/stats");
    await click(booted.root, '[data-action="view"][data-view="account"]');
    await click(booted.root, '[data-action="view"][data-view="home"]');

    world = createWorld();
    world.catalog = [];
    world.franchises = [];
    world.progress.ids = [];
    booted = await boot("/");
    await click(booted.root, '[data-action="view"][data-view="stats"]');
    expect(booted.root.textContent).toContain("The vault is still opening");

    world = createWorld();
    const first = await boot("/upcoming");
    world.upcoming = {
      films: [{ kind: "film", tmdbId: 9, title: "Moved", releaseDate: "2096-02-02" }],
      shows: createWorld().upcoming.shows,
    };
    await boot("/upcoming", false);
    expect(first.root.isConnected).toBe(true);

    world = createWorld();
    world.upcoming = { films: [], shows: [{ kind: "show", tmdbId: 3, title: "Only show", releaseDate: "2098-01-02" }] };
    await boot("/upcoming");
    await boot("/upcoming", false);

    world = createWorld();
    world.upcoming = { films: [{ kind: "film", tmdbId: 4, title: "Only film", releaseDate: "2098-01-03" }], shows: [] };
    await boot("/upcoming");
    await boot("/upcoming", false);
  }, 60_000);

  it("covers profile links, popstate, and install", async () => {
    const { root } = await boot("/profile/7");
    expect(root.textContent).toContain("Gina");
    window.history.pushState({}, "", "/profile/7");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
    window.history.pushState({}, "", "/profile/8");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
    window.history.pushState({}, "", "/profile/0");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
    window.history.pushState({}, "", "/account");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
    window.history.pushState({}, "", "/library?kind=show&q=zone&tag=vampire&franchises=1");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
    window.history.pushState({}, "", "/nope");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
    await click(root, '[data-action="view"][data-view="account"]');
    await clickAction(root, "logout");
    window.history.pushState({}, "", "/account");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
    window.history.pushState({}, "", "/profile/7");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();

    world = createWorld();
    world.user = null;
    const guest = await boot("/profile/7");
    expect(guest.root.textContent).toContain("Gina");
    world.down.add("/api/people");
    world.downMode = "string";
    const missing = await boot("/profile/8");
    expect(missing.root.textContent).toContain("profile");

    world = createWorld();
    const installed = await boot("/install");
    await inject(installed.root, { "data-action": "install" });
    const { registerPwa } = await import("./pwa");
    registerPwa();
    await settle();
    expect(installed.root.querySelector('[data-action="dismiss-update"]')).toBeTruthy();
    await click(installed.root, '[data-action="view"][data-view="library"]');
    await click(installed.root, '[data-action="open-add"]');
    await clickAction(installed.root, "close-sheet");
    await click(installed.root, '[data-action="view"][data-view="home"]');
    await clickAction(installed.root, "open-badge", "data-badge", "first-blood");
    await clickAction(installed.root, "close-badge");
    await click(installed.root, '[data-action="view"][data-view="library"]');
    await clickAction(installed.root, "open-lists", "data-id", "movie:1");
    await clickAction(installed.root, "close-lists");
    await clickAction(installed.root, "open-franchise-lists", "data-franchise-id", "2");
    await clickAction(installed.root, "close-lists");
    await clickAction(installed.root, "open-franchises", "data-id", "movie:1");
    await clickAction(installed.root, "close-franchises");
    await clickAction(installed.root, "open-franchise-add", "data-franchise-id", "1");
    await clickAction(installed.root, "close-franchises");
    await clickAction(installed.root, "open-watch", "data-id", "movie:1");
    await clickAction(installed.root, "close-watch");
    await clickAction(installed.root, "open-when", "data-id", "movie:1");
    await clickAction(installed.root, "close-when");
    await clickAction(installed.root, "dismiss-update");
    registerPwa();
    await settle();
    await clickAction(installed.root, "apply-update");
    const prompt = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(prompt, { prompt: async () => undefined, userChoice: Promise.resolve({ outcome: "accepted" }) });
    window.dispatchEvent(prompt);
    await settle();
    await click(installed.root, '[data-action="view"][data-view="install"]');
    await clickAction(installed.root, "install");
    window.dispatchEvent(new Event("appinstalled"));
    await settle();

    Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => "Mozilla/5.0 (iPhone)" });
    await click(installed.root, '[data-action="view"][data-view="install"]');
    Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => "Mozilla/5.0 Macintosh" });
    Object.defineProperty(navigator, "platform", { configurable: true, get: () => "MacIntel" });
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, get: () => 2 });
    await click(installed.root, '[data-action="view"][data-view="home"]');
    await click(installed.root, '[data-action="view"][data-view="install"]');
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, get: () => 0 });
    await click(installed.root, '[data-action="view"][data-view="install"]');
    standaloneMatch = true;
    await click(installed.root, '[data-action="view"][data-view="home"]');
    window.history.pushState({}, "", "/install");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
    standaloneMatch = false;
    navStandalone = true;
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await settle();
  }, 60_000);

  it("covers busy guards and sheet-kind edges", async () => {
    const { root } = await boot("/library");
    await clickAction(root, "toggle-show", "data-show-id", "4");
    await clickAction(root, "open-when", "data-id", "movie:1");
    await clickAction(root, "close-when");
    await click(root, '[data-action="open-add"]');
    arm("PATCH /api/progress");
    const toggle = must<HTMLElement>(root, '[data-action="toggle"][data-id="movie:3"]');
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await untilWaiting("PATCH /api/progress");
    const busy: Record<string, string>[] = [
      { "data-action": "list-visibility", "data-list-id": "1" },
      { "data-action": "toggle-episode", "data-episode-id": "11" },
      { "data-action": "toggle-season", "data-season-id": "2" },
      { "data-action": "when-now" },
      { "data-action": "when-undated" },
      { "data-action": "import-tmdb", "data-tmdb-id": "55", "data-source-id": "OL12W" },
      { "data-action": "toggle", "data-id": "movie:1" },
      { "data-action": "set-score", "data-id": "movie:1", "data-score": "2" },
      { "data-action": "toggle-list-item", "data-list-id": "1", "data-id": "movie:1" },
      { "data-action": "toggle-franchise-list", "data-list-id": "1", "data-franchise-id": "2" },
      { "data-action": "rename-list", "data-list-id": "1" },
      { "data-action": "delete-list", "data-list-id": "1" },
      { "data-action": "toggle-franchise-item", "data-franchise-id": "1", "data-id": "movie:1" },
      { "data-action": "remove-franchise-item", "data-franchise-id": "1", "data-id": "movie:1" },
      { "data-action": "rename-franchise", "data-franchise-id": "1" },
      { "data-action": "delete-franchise", "data-franchise-id": "1" },
      { "data-action": "delete", "data-id": "movie:1" },
    ];
    for (const attrs of busy) await inject(root, attrs, true);
    await submitHtml(root, `<form data-catalog-form><input name="title" value="Busy" /></form>`);
    await submitHtml(root, `<form data-list-form><input name="name" value="Busy" /></form>`);
    await submitHtml(root, `<form data-franchise-form><input name="name" value="Busy" /></form>`);
    await submitHtml(root, `<form data-tmdb-form><input name="q" value="scream" /></form>`);
    await submitHtml(root, `<form data-when-year><input name="year" value="1999" /></form>`);
    gates.get("PATCH /api/progress")?.release();
    await settle();

    await clickAction(root, "close-sheet");
    await click(root, '[data-action="view"][data-view="account"]');
    await submit(root, "[data-people-search]", { query: "eve" });
    arm("POST /api/friends");
    void clickAction(root, "friend-request", "data-user-id", "5");
    await untilWaiting("POST /api/friends");
    for (const attrs of [
      { "data-action": "friend-request", "data-user-id": "5" },
      { "data-action": "friend-respond", "data-user-id": "3", "data-respond": "accept" },
      { "data-action": "unfriend", "data-user-id": "7" },
      { "data-action": "follow-person", "data-user-id": "5" },
      { "data-action": "unfollow-person", "data-user-id": "6" },
    ]) await inject(root, attrs, true);
    await submitHtml(root, `<form data-people-search><input name="query" value="eve" /></form>`);
    gates.get("POST /api/friends")?.release();
    await settle();

    arm("PATCH /api/auth");
    void submit(root, "[data-profile-form]", { displayName: "Ada", aboutMe: "Busy" });
    await untilWaiting("PATCH /api/auth");
    await submit(root, "[data-profile-form]", { displayName: "Ada", aboutMe: "Busy" });
    gates.get("PATCH /api/auth")?.release();
    await settle();

    const share = await shareMod();
    const story = await storyMod();
    let releaseShare: (value: Blob) => void = () => undefined;
    vi.mocked(story.renderTitleStoryCard).mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseShare = resolve;
        }),
    );
    const shareButton = must<HTMLElement>(root, '[data-action="share-title"], [data-action="share-recap"]');
    if (shareButton.dataset.action !== "share-title") {
      await click(root, '[data-action="view"][data-view="library"]');
    }
    const titleShare = must<HTMLElement>(root, '[data-action="share-title"]');
    titleShare.click();
    await vi.waitFor(() => {
      if (!vi.mocked(story.renderTitleStoryCard).mock.calls.length) throw new Error("share not started");
    });
    titleShare.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const recap = root.querySelector<HTMLElement>('[data-action="share-recap"]');
    recap?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    releaseShare(new Blob(["ok"]));
    vi.mocked(share.shareStoryImage).mockResolvedValue("shared");
    await settle();

    await click(root, '[data-action="filter"][data-filter="podcast"]');
    await click(root, '[data-action="open-add"]');
    await clickAction(root, "close-sheet");
    await click(root, '[data-action="view"][data-view="library"]');
    await click(root, '[data-action="open-add"]');
    await inject(root, { "data-action": "logout" });
    const select = document.createElement("select");
    select.dataset.sheetKind = "";
    select.innerHTML = `<option value="movie">Movie</option>`;
    root.append(select);
    select.value = "movie";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    await submitHtml(root, `<form data-tmdb-form><input name="q" value="scream" /></form>`);
  }, 60_000);

  it("covers leftover branches", async () => {
    world.progress = {
      ...world.progress,
      watchNext: [{ id: "movie:3", title: "Orphan", kind: "movie", reason: "series" }],
      readNext: [{ id: "book:7", title: "It", kind: "book", reason: "vault" }],
    };
    const { root, mountApp } = await boot("/");
    expect(root.textContent).toContain("Administrator");
    await inject(root, { "data-action": "open-watch", "data-id": "movie:1" });
    await clickAction(root, "close-watch");
    await inject(root, { "data-action": "open-watch", "data-id": "movie:83" });
    await clickAction(root, "close-watch");
    await clickAction(root, "recent-kind", "data-kind", "show");
    await inject(root, { "data-action": "set-score", "data-id": "movie:1", "data-score": "4" });
    await inject(root, { "data-action": "set-score", "data-id": "movie:1", "data-score": "4" });
    await clickAction(root, "open-badge", "data-badge", "first-blood");
    world.nextProgress = { ...world.progress, ids: [], scores: {}, recentIds: [], undatedIds: [], watchedYears: {}, watchNext: [], readNext: [] };
    await inject(root, { "data-action": "toggle", "data-id": "movie:1" });
    await inject(root, { "data-action": "share-title", "data-id": "movie:3" });
    await inject(root, { "data-action": "share-recap" });
    world.nextProgress = { ...world.progress, ids: ["movie:3"], scores: {}, recentIds: ["movie:3"], undatedIds: [], watchedYears: {}, watchNext: [], readNext: [] };
    await inject(root, { "data-action": "toggle", "data-id": "movie:80" });
    await click(root, '[data-action="view"][data-view="account"]');
    await clickAction(root, "share-recap");
    await click(root, '[data-action="view"][data-view="home"]');
    await inject(root, { "data-action": "close-badge" });

    await click(root, '[data-action="view"][data-view="library"]');
    await clickAction(root, "toggle-show", "data-show-id", "4");
    await clickAction(root, "toggle-show-season", "data-show-id", "4", );
    await clickAction(root, "toggle-show-season", "data-season-number", "1");
    await clickAction(root, "toggle-show-season", "data-season-number", "1");
    await clickAction(root, "toggle-show", "data-show-id", "5");
    await inject(root, { "data-action": "toggle-show-season", "data-show-id": "5", "data-season-number": "1" });

    const films = world.lists.find((list) => list.id === 5);
    if (films) films.items = ["movie:3", "movie:80"];
    await inject(root, { "data-action": "open-franchise-lists", "data-franchise-id": "5" });
    await inject(root, { "data-action": "toggle-franchise-list", "data-list-id": "5", "data-franchise-id": "5" });
    await click(root, '[data-action="view"][data-view="lists"]');
    confirms = [true];
    await clickAction(root, "delete-list", "data-list-id", "2");
    failNext("GET /api/shows", "boom");
    await inject(root, { "data-action": "toggle-show", "data-show-id": "6" });
    await click(root, '[data-action="view"][data-view="library"]');
    failNext("GET /api/shows", "offline");
    await inject(root, { "data-action": "toggle-show", "data-show-id": "8" });

    await inject(root, { "data-action": "filter-tag" });
    await inject(root, { "data-action": "recent-kind" });
    await inject(root, { "data-action": "library-page", "data-page": "1" });
    await inject(root, { "data-action": "filter", "data-filter": "nope" });
    await submitHtml(root, `<form data-when-year><input name="year" value="1991" /></form>`);

    await inject(root, { "data-action": "open-when-episode", "data-show-id": "4", "data-episode-id": "11" });
    arm("PATCH /api/progress");
    void inject(root, { "data-action": "toggle", "data-id": "movie:3" });
    await untilWaiting("PATCH /api/progress");
    await inject(root, { "data-action": "when-now" }, true);
    gates.get("PATCH /api/progress")?.release();
    await settle();

    await click(root, '[data-action="open-add"]');
    failNext("POST /api/catalog", "status");
    await submitHtml(root, `<form data-catalog-form="add"></form>`);
    await submitHtml(root, `<form data-tmdb-form></form>`);
    await submit(root, "[data-tmdb-form]", { q: "scream" });
    await changed(root, "[data-sheet-kind]", "show");
    const kind = must<HTMLSelectElement>(root, "[data-sheet-kind]");
    kind.value = "nope";
    kind.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    await changed(root, "[data-sheet-kind]", "podcast");
    await inject(root, { "data-action": "import-tmdb", "data-tmdb-id": "55" });
    await inject(root, { "data-action": "open-edit", "data-id": "book:7" });
    const editKind = document.createElement("select");
    editKind.dataset.sheetKind = "";
    editKind.innerHTML = `<option value="book">Book</option>`;
    root.append(editKind);
    editKind.value = "book";
    editKind.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    await clickAction(root, "close-sheet");
    failNext("GET /api/shows", "status");
    await inject(root, { "data-action": "toggle-show", "data-show-id": "9" });
    await inject(root, { "data-action": "open-when-episode", "data-show-id": "9", "data-episode-id": "1" });
    await inject(root, { "data-action": "open-franchise-add", "data-franchise-id": "1" });
    await typeField(root, "[data-franchise-search]", "zzzz-none", "range");
    expect(root.textContent).toContain("No vault titles match that search.");
    failNext("POST /api/franchises", "status");
    await inject(root, { "data-action": "toggle-franchise-item", "data-franchise-id": "1", "data-id": "movie:70" });
    expect(root.textContent).toContain("Nope");
    await clickAction(root, "close-franchises");
    failNext("GET /api/tmdb", "status");
    await click(root, '[data-action="open-tmdb"]');
    const tmdbKind = document.createElement("select");
    tmdbKind.dataset.sheetKind = "";
    tmdbKind.innerHTML = `<option value="book">Book</option>`;
    root.append(tmdbKind);
    tmdbKind.value = "book";
    tmdbKind.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    await submit(root, "[data-tmdb-form]", { q: "scream" });
    await clickAction(root, "close-sheet");
    await submitHtml(root, `<form data-auth-form="login"></form>`);
    await submitHtml(root, `<form data-catalog-form="add"></form>`);
    await submitHtml(root, `<form data-profile-form></form>`);
    await submitHtml(root, `<form data-people-search></form>`);
    await submitHtml(root, `<form data-list-form></form>`);
    await submitHtml(root, `<form data-franchise-form></form>`);
    await submitHtml(root, `<form data-tmdb-form></form>`);

    failNext("GET /api/watch", "status");
    await inject(root, { "data-action": "open-watch", "data-id": "movie:84" });
    await clickAction(root, "close-watch");
    failNext("GET /api/watch", "boom");
    await inject(root, { "data-action": "open-watch", "data-id": "movie:91" });
    await clickAction(root, "close-watch");
    world.watch = { title: "Scream", region: "US", streaming: [{ name: "Shudder", logo: "https://image.tmdb.org/t/p/w45/s.jpg" }], free: [], rent: [], buy: [], attribution: "JustWatch" };
    await inject(root, { "data-action": "filter", "data-filter": "all" });
    await click(root, '[data-action="view"][data-view="library"]');
    await inject(root, { "data-action": "open-watch", "data-id": "movie:3" });
    world.importId = "show:4";
    await click(root, '[data-action="open-tmdb"]');
    await inject(root, { "data-action": "import-tmdb", "data-tmdb-id": "55" });
    await clickAction(root, "close-lists");

    await click(root, '[data-action="view"][data-view="account"]');
    await inject(root, { "data-action": "open-person", "data-user-id": "8" });
    await inject(root, { "data-action": "friend-request", "data-user-id": "8" });
    await click(root, '[data-action="view"][data-view="account"]');
    await clickAction(root, "open-person", "data-user-id", "7");
    failNext("POST /api/follows", "status");
    await inject(root, { "data-action": "follow-person", "data-user-id": "7" });
    expect(root.textContent).toContain("Nope");
    window.history.replaceState({}, "", "/profile/7");
    mountApp(root);
    await settle();
  }, 60_000);

  it("covers empty vault copy", async () => {
    world.user = member;
    world.friends = { friends: [], incoming: [], outgoing: [], following: [] };
    world.lists = [];
    world.catalog = world.catalog.filter((item) => item.kind === "movie");
    const { root } = await boot("/library");
    await click(root, '[data-action="view"][data-view="account"]');
    await click(root, '[data-action="view"][data-view="home"]');
    await click(root, '[data-action="view"][data-view="library"]');
    await inject(root, { "data-action": "filter", "data-filter": "show" });
    await inject(root, { "data-action": "open-lists", "data-id": "movie:1" });
    await click(root, '[data-action="view"][data-view="lists"]');

    world.user = admin;
    world.lists = [];
    world.franchises = [{ id: 1, name: "Only", items: ["movie:1"] }];
    const noLists = await boot("/library");
    await inject(noLists.root, { "data-action": "open-franchise-add", "data-franchise-id": "1" });
    await changed(noLists.root, "[data-franchise-kind]", "book");
    expect(noLists.root.textContent).toContain("No titles of that type in the vault yet.");
    await clickAction(noLists.root, "close-franchises");
    await inject(noLists.root, { "data-action": "open-franchise-lists", "data-franchise-id": "1" });
    expect(noLists.root.textContent).toContain("Create a list first.");

    world.franchises = [];
    world.lists = [];
    world.catalog = createWorld().catalog.filter((item) => item.kind === "movie");
    const emptyFranchises = await boot("/library");
    expect(emptyFranchises.root.textContent).toContain("No franchises yet.");
    await typeField(emptyFranchises.root, "[data-library-search]", "zzzz", "range");
    expect(emptyFranchises.root.textContent).toContain("No franchises match that search.");
    await inject(emptyFranchises.root, { "data-action": "open-franchises", "data-id": "movie:1" });
    await inject(emptyFranchises.root, { "data-action": "open-franchise-add", "data-franchise-id": "1" });

    world.down.add("/api/catalog");
    const down = await boot("/library");
    expect(down.root.textContent).toContain("unreachable");
  }, 60_000);
});
