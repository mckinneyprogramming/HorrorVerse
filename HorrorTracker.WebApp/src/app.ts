import {
  createCatalogEntry,
  deleteCatalogEntry,
  fetchCatalog,
  isMediaKind,
  MEDIA_KINDS,
  formatRuntime,
  movieDetailLine,
  updateCatalogEntry,
  WRITABLE_KINDS,
  type CatalogEntry,
  type MediaKind,
} from "./catalog";
import {
  fetchCurrentUser,
  loginAccount,
  logoutAccount,
  registerAccount,
  type AuthUser,
} from "./auth";
import { fetchProgressIds, setProgress } from "./progress";
import {
  addListItem,
  createList,
  deleteList,
  fetchLists,
  removeListItem,
  renameList,
  type UserList,
} from "./lists";
import { importTmdb, searchTmdb, type TmdbHit } from "./tmdb";
import { buildHorrorStats, type FunStat, type StatGroup } from "./stats";
import { fetchShowGuide, setEpisodeProgress, setSeasonProgress, setShowProgress, type ShowGuide } from "./shows";
import { syncVault } from "./sync";
import { canPromptInstall, canPromptUpdate, applyPendingUpdate, dismissPendingUpdate, isIosDevice, isStandalone, onInstallAvailabilityChange, promptInstall } from "./pwa";

type View = "home" | "library" | "lists" | "account" | "install";
type LibraryFilter = MediaKind | "all";
type LoadStatus = "loading" | "ready" | "error";
type AuthMode = "login" | "register";
type SheetMode = "add" | "edit" | "tmdb";

interface CatalogSheet {
  mode: SheetMode;
  entry?: CatalogEntry;
}

interface AppState {
  view: View;
  filter: LibraryFilter;
  entries: CatalogEntry[];
  status: LoadStatus;
  user: AuthUser | null;
  authMode: AuthMode;
  authMessage: string;
  authBusy: boolean;
  sheet: CatalogSheet | null;
  catalogBusy: boolean;
  catalogMessage: string;
  collapsedKinds: Set<MediaKind>;
  expandedSeriesIds: Set<number>;
  expandedListSeries: Set<string>;
  libraryQuery: string;
  finishedIds: string[];
  lists: UserList[];
  listPicker: CatalogEntry | null;
  listMessage: string;
  sheetKind: MediaKind;
  tmdbQuery: string;
  tmdbResults: TmdbHit[];
  showGuides: Record<number, ShowGuide>;
  expandedShowIds: Set<number>;
  expandedShowSeasons: Set<string>;
}

const state: AppState = {
  view: "home",
  filter: "all",
  entries: [],
  status: "loading",
  user: null,
  authMode: "login",
  authMessage: "",
  authBusy: false,
  sheet: null,
  catalogBusy: false,
  catalogMessage: "",
  collapsedKinds: new Set<MediaKind>(),
  expandedSeriesIds: new Set<number>(),
  expandedListSeries: new Set<string>(),
  libraryQuery: "",
  finishedIds: [],
  lists: [],
  listPicker: null,
  listMessage: "",
  sheetKind: "movie",
  tmdbQuery: "",
  tmdbResults: [],
  showGuides: {},
  expandedShowIds: new Set<number>(),
  expandedShowSeasons: new Set<string>(),
};

export function mountApp(root: HTMLElement): void {
  render(root);
  onInstallAvailabilityChange(() => render(root));
  void refreshCatalog(root);
  void (async () => {
    await refreshUser(root);
    if (state.user) {
      await applyVaultRefresh(root);
    }
  })();

  root.addEventListener("click", async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!target) {
      return;
    }

    const action = target.dataset.action;
    if (action === "view") {
      state.view = target.dataset.view as View;
      if (target.dataset.filter) {
        state.filter = target.dataset.filter as LibraryFilter;
      }
      state.authMessage = "";
      state.sheet = null;
      state.listPicker = null;
      state.listMessage = "";
      render(root);
      return;
    }

    if (action === "stat-open") {
      const filter = target.dataset.filter;
      state.view = "library";
      state.filter = filter === "all" || (filter && isMediaKind(filter)) ? filter : "all";
      state.libraryQuery = target.dataset.query ?? "";
      state.sheet = null;
      state.listPicker = null;
      render(root);
      return;
    }

    if (action === "filter") {
      state.filter = target.dataset.filter as LibraryFilter;
      render(root);
      return;
    }

    if (action === "clear-search") {
      state.libraryQuery = "";
      render(root);
      root.querySelector<HTMLInputElement>("[data-library-search]")?.focus();
      return;
    }

    if (action === "toggle-kind") {
      event.preventDefault();
      const kind = target.dataset.kind;
      if (!kind || !isMediaKind(kind)) {
        return;
      }

      if (state.collapsedKinds.has(kind)) {
        state.collapsedKinds.delete(kind);
      } else {
        state.collapsedKinds.add(kind);
      }

      render(root);
      return;
    }

    if (action === "toggle-series") {
      event.preventDefault();
      const seriesId = Number(target.dataset.seriesId);
      if (!Number.isInteger(seriesId)) {
        return;
      }

      if (state.expandedSeriesIds.has(seriesId)) {
        state.expandedSeriesIds.delete(seriesId);
        render(root);
        return;
      }

      state.expandedSeriesIds.add(seriesId);
      render(root);
      await applyVaultRefresh(root, `series:${seriesId}`);
      return;
    }

    if (action === "toggle-show") {
      event.preventDefault();
      const showId = Number(target.dataset.showId);
      if (!Number.isInteger(showId) || !state.user) {
        return;
      }

      if (state.expandedShowIds.has(showId)) {
        state.expandedShowIds.delete(showId);
        render(root);
        return;
      }

      state.expandedShowIds.add(showId);
      render(root);
      await loadShowGuide(root, showId);
      return;
    }

    if (action === "toggle-show-season") {
      event.preventDefault();
      const showId = Number(target.dataset.showId);
      const seasonNumber = Number(target.dataset.seasonNumber);
      const key = showSeasonKey(showId, seasonNumber);
      if (!key || !state.user) {
        return;
      }

      if (state.expandedShowSeasons.has(key)) {
        state.expandedShowSeasons.delete(key);
        render(root);
        return;
      }

      state.expandedShowSeasons.add(key);
      render(root);
      await loadShowGuide(root, showId, seasonNumber);
      return;
    }

    if (action === "toggle-episode") {
      if (!state.user) {
        state.view = "account";
        render(root);
        return;
      }

      const episodeId = Number(target.dataset.episodeId);
      const completed = target.dataset.completed !== "true";
      if (!Number.isInteger(episodeId) || state.catalogBusy) {
        return;
      }

      await saveUserLibrary(root, async () => {
        const guide = await setEpisodeProgress(episodeId, completed);
        state.showGuides[guide.showId] = guide;
        state.finishedIds = await fetchProgressIds();
      });
      return;
    }

    if (action === "toggle-season") {
      if (!state.user) {
        state.view = "account";
        render(root);
        return;
      }

      const seasonId = Number(target.dataset.seasonId);
      const completed = target.dataset.completed !== "true";
      if (!Number.isInteger(seasonId) || state.catalogBusy) {
        return;
      }

      await saveUserLibrary(root, async () => {
        const guide = await setSeasonProgress(seasonId, completed);
        state.showGuides[guide.showId] = guide;
        state.finishedIds = await fetchProgressIds();
      });
      return;
    }

    if (action === "toggle-list-series") {
      event.preventDefault();
      const key = listSeriesKey(target.dataset.listId, target.dataset.seriesId);
      const seriesId = Number(target.dataset.seriesId);
      if (!key) {
        return;
      }

      if (state.expandedListSeries.has(key)) {
        state.expandedListSeries.delete(key);
        render(root);
        return;
      }

      state.expandedListSeries.add(key);
      render(root);
      if (Number.isInteger(seriesId)) {
        await applyVaultRefresh(root, `series:${seriesId}`);
      }
      return;
    }

    if (action === "reload") {
      await refreshCatalog(root);
      return;
    }

    if (action === "auth-mode") {
      state.authMode = target.dataset.mode as AuthMode;
      state.authMessage = "";
      render(root);
      return;
    }

    if (action === "logout") {
      state.authBusy = true;
      render(root);
      await logoutAccount();
      state.user = null;
      state.finishedIds = [];
      state.lists = [];
      state.listPicker = null;
      state.authBusy = false;
      state.authMessage = "";
      render(root);
      return;
    }

    if (action === "install") {
      await promptInstall();
      render(root);
      return;
    }

    if (action === "apply-update") {
      await applyPendingUpdate();
      return;
    }

    if (action === "dismiss-update") {
      dismissPendingUpdate();
      render(root);
      return;
    }

    if (action === "open-add" && state.user?.isAdmin) {
      state.sheet = { mode: "add" };
      state.sheetKind = defaultSheetKind();
      state.tmdbQuery = "";
      state.tmdbResults = [];
      state.catalogMessage = "";
      render(root);
      return;
    }

    if (action === "open-tmdb") {
      if (!state.user) {
        state.view = "account";
        render(root);
        return;
      }

      state.sheet = { mode: "tmdb" };
      state.sheetKind = defaultTmdbKind();
      state.tmdbQuery = state.libraryQuery.trim();
      state.tmdbResults = [];
      state.catalogMessage = "";
      render(root);
      if (state.tmdbQuery.length >= 2) {
        await runTmdbSearch(root);
      }
      return;
    }

    if (action === "open-edit" && state.user?.isAdmin) {
      const entry = state.entries.find((item) => item.id === target.dataset.id);
      if (!entry) {
        return;
      }

      state.sheet = { mode: "edit", entry };
      state.catalogMessage = "";
      render(root);
      return;
    }

    if (action === "close-sheet") {
      state.sheet = null;
      state.tmdbResults = [];
      state.catalogMessage = "";
      render(root);
      return;
    }

    if (action === "import-tmdb" && state.user) {
      const tmdbId = Number(target.dataset.tmdbId);
      if (!canUseTmdbSheet() || state.catalogBusy || !Number.isInteger(tmdbId)) {
        return;
      }

      await saveCatalogChange(root, () => importTmdb(state.sheetKind, tmdbId), {
        openListPicker: state.sheet?.mode === "tmdb",
      });
      return;
    }

    if (action === "toggle") {
      if (!state.user) {
        state.view = "account";
        render(root);
        return;
      }

      const entry = state.entries.find((item) => item.id === target.dataset.id);
      if (!entry || state.catalogBusy) {
        return;
      }

      const completed = !isFinished(entry);
      await saveUserLibrary(root, async () => {
        if (entry.kind === "show") {
          const guide = await setShowProgress(entry.mediaId, completed);
          state.showGuides[guide.showId] = guide;
          state.finishedIds = await fetchProgressIds();
          return;
        }

        state.finishedIds = await setProgress(entry.id, completed);
      });
      return;
    }

    if (action === "open-lists") {
      if (!state.user) {
        state.view = "account";
        render(root);
        return;
      }

      const entry = state.entries.find((item) => item.id === target.dataset.id);
      if (!entry) {
        return;
      }

      state.listPicker = entry;
      state.listMessage = "";
      render(root);
      return;
    }

    if (action === "close-lists") {
      state.listPicker = null;
      state.listMessage = "";
      render(root);
      return;
    }

    if (action === "toggle-list-item") {
      const listId = Number(target.dataset.listId);
      const itemId = target.dataset.id;
      const list = state.lists.find((item) => item.id === listId);
      if (!state.user || !itemId || !list || state.catalogBusy) {
        return;
      }

      await saveUserLibrary(root, async () => {
        state.lists = list.items.includes(itemId)
          ? await removeListItem(listId, itemId)
          : await addListItem(listId, itemId);
      });
      return;
    }

    if (action === "rename-list") {
      const list = state.lists.find((item) => item.id === Number(target.dataset.listId));
      if (!list || state.catalogBusy) {
        return;
      }

      const name = window.prompt("Rename list", list.name);
      if (name === null) {
        return;
      }

      await saveUserLibrary(root, async () => {
        state.lists = await renameList(list.id, name);
      });
      return;
    }

    if (action === "delete-list") {
      const list = state.lists.find((item) => item.id === Number(target.dataset.listId));
      if (!list || state.catalogBusy) {
        return;
      }

      if (!window.confirm(`Delete the list “${list.name}”?`)) {
        return;
      }

      await saveUserLibrary(root, async () => {
        state.lists = await deleteList(list.id);
      });
      return;
    }

    if (action === "delete" && state.user?.isAdmin) {
      const entry = state.entries.find((item) => item.id === target.dataset.id);
      if (!entry || state.catalogBusy) {
        return;
      }

      if (!window.confirm(`Remove “${entry.title}” from the vault?`)) {
        return;
      }

      await saveCatalogChange(root, async () => {
        await deleteCatalogEntry(entry.id);
        return null;
      });
    }
  });

  root.addEventListener("submit", async (event) => {
    const form = (event.target as HTMLElement).closest<HTMLFormElement>("[data-auth-form]");
    if (!form) {
      return;
    }

    event.preventDefault();
    if (state.authBusy) {
      return;
    }

    const data = new FormData(form);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    const displayName = String(data.get("displayName") ?? "");

    state.authBusy = true;
    state.authMessage = "";
    render(root);

    try {
      state.user =
        form.dataset.authForm === "register"
          ? await registerAccount({ email, password, displayName })
          : await loginAccount({ email, password });
      state.authMessage = "";
      await refreshUserLibrary(root);
    } catch (error) {
      state.authMessage = error instanceof Error ? error.message : "Could not sign in.";
    }

    state.authBusy = false;
    render(root);
  });

  root.addEventListener("submit", async (event) => {
    const catalogForm = (event.target as HTMLElement).closest<HTMLFormElement>("[data-catalog-form]");
    if (!catalogForm) {
      return;
    }

    event.preventDefault();
    if (!state.user?.isAdmin || state.catalogBusy || !state.sheet) {
      return;
    }

    const data = new FormData(catalogForm);
    const title = String(data.get("title") ?? "");
    const kind = state.sheet.mode === "add" ? state.sheetKind : String(data.get("kind") ?? state.sheet.entry?.kind ?? "movie");
    const completed = data.get("completed") === "on";
    const releaseYear = Number(data.get("releaseYear") ?? 0);

    await saveCatalogChange(root, async () => {
      if (state.sheet?.mode === "edit" && state.sheet.entry) {
        return updateCatalogEntry({ id: state.sheet.entry.id, title, completed });
      }

      return createCatalogEntry({
        title,
        kind,
        completed,
        releaseYear: Number.isInteger(releaseYear) && releaseYear > 0 ? releaseYear : undefined,
      });
    });
  });

  root.addEventListener("submit", (event) => {
    const searchForm = (event.target as HTMLElement).closest("[data-library-search-form]");
    if (!searchForm) {
      return;
    }

    event.preventDefault();
  });

  root.addEventListener("submit", async (event) => {
    const listForm = (event.target as HTMLElement).closest<HTMLFormElement>("[data-list-form]");
    if (!listForm) {
      return;
    }

    event.preventDefault();
    if (!state.user || state.catalogBusy) {
      return;
    }

    const data = new FormData(listForm);
    const name = String(data.get("name") ?? "");
    await saveUserLibrary(root, async () => {
      state.lists = await createList(name);
    });
  });

  root.addEventListener("submit", async (event) => {
    const tmdbForm = (event.target as HTMLElement).closest<HTMLFormElement>("[data-tmdb-form]");
    if (!tmdbForm) {
      return;
    }

    event.preventDefault();
    if (!state.user || state.catalogBusy || !canUseTmdbSheet()) {
      return;
    }

    const data = new FormData(tmdbForm);
    state.tmdbQuery = String(data.get("q") ?? "");
    await runTmdbSearch(root);
  });

  root.addEventListener("change", async (event) => {
    const libraryKind = (event.target as HTMLElement).closest<HTMLInputElement>("[data-library-kind]");
    if (libraryKind) {
      const value = libraryKind.value;
      if (value === "all" || isMediaKind(value)) {
        state.filter = value;
        render(root);
      }
      return;
    }

    const kindInput = (event.target as HTMLElement).closest<HTMLInputElement | HTMLSelectElement>("[data-sheet-kind]");
    if (!kindInput || !state.sheet || (state.sheet.mode !== "add" && state.sheet.mode !== "tmdb")) {
      return;
    }

    if (!isMediaKind(kindInput.value)) {
      return;
    }

    state.sheetKind = kindInput.value;
    state.tmdbResults = [];
    state.catalogMessage = "";
    render(root);
    if (state.tmdbQuery.trim().length >= 2 && canUseTmdbSheet()) {
      await runTmdbSearch(root);
    }
  });

  root.addEventListener("input", (event) => {
    const search = (event.target as HTMLElement).closest<HTMLInputElement>("[data-library-search]");
    if (!search) {
      return;
    }

    state.libraryQuery = search.value;
    const start = search.selectionStart;
    const end = search.selectionEnd;
    render(root);
    const next = root.querySelector<HTMLInputElement>("[data-library-search]");
    if (!next) {
      return;
    }

    next.focus();
    if (start !== null && end !== null) {
      next.setSelectionRange(start, end);
    }
  });
}

async function applyVaultRefresh(root: HTMLElement, id?: string): Promise<void> {
  if (!state.user) {
    return;
  }

  try {
    const added = await syncVault(id);
    if (added < 1) {
      return;
    }

    state.entries = await fetchCatalog();
    try {
      const [ids, lists] = await Promise.all([fetchProgressIds(), fetchLists()]);
      state.finishedIds = ids;
      state.lists = lists;
    } catch {
      // Keep last library state if a refresh request fails.
    }

    render(root);
  } catch {
    // Daily TMDb sync will catch up if this request fails.
  }
}

async function refreshCatalog(root: HTMLElement): Promise<void> {
  state.status = "loading";
  render(root);

  try {
    state.entries = await fetchCatalog();
    state.status = "ready";
  } catch {
    state.entries = [];
    state.status = "error";
  }

  render(root);
}

async function refreshUser(root: HTMLElement): Promise<void> {
  state.user = await fetchCurrentUser();
  await refreshUserLibrary(root);
}

async function refreshUserLibrary(root: HTMLElement): Promise<void> {
  if (!state.user) {
    state.finishedIds = [];
    state.lists = [];
    state.listPicker = null;
    render(root);
    return;
  }

  try {
    const [ids, lists] = await Promise.all([fetchProgressIds(), fetchLists()]);
    state.finishedIds = ids;
    state.lists = lists;
  } catch {
    state.finishedIds = [];
    state.lists = [];
  }

  render(root);
}

async function loadShowGuide(root: HTMLElement, showId: number, season?: number): Promise<void> {
  try {
    state.showGuides[showId] = await fetchShowGuide(showId, season);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load seasons for that show.";
    if (state.view === "lists") {
      state.listMessage = message;
    } else {
      state.catalogMessage = message;
    }
  }

  render(root);
}

function showSeasonKey(showId: number | string | undefined, seasonNumber: number | string | undefined): string {
  const show = Number(showId);
  const season = Number(seasonNumber);
  return Number.isInteger(show) && Number.isInteger(season) ? `${show}:${season}` : "";
}

async function saveUserLibrary(root: HTMLElement, work: () => Promise<void>): Promise<void> {
  state.catalogBusy = true;
  state.listMessage = "";
  state.catalogMessage = "";
  render(root);

  try {
    await work();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update your library.";
    if (state.view === "lists" || state.listPicker) {
      state.listMessage = message;
    } else {
      state.catalogMessage = message;
    }
  }

  state.catalogBusy = false;
  render(root);
}

async function saveCatalogChange(
  root: HTMLElement,
  work: () => Promise<unknown>,
  options?: { openListPicker?: boolean },
): Promise<void> {
  state.catalogBusy = true;
  state.catalogMessage = "";
  render(root);

  try {
    const result = await work();
    state.entries = await fetchCatalog();
    if (state.user) {
      try {
        state.lists = await fetchLists();
      } catch {
        // Lists stay as last loaded if the request fails.
      }
    }
    state.status = "ready";
    state.sheet = null;
    state.tmdbResults = [];
    state.catalogMessage = "";
    if (options?.openListPicker && typeof result === "string") {
      const entry = state.entries.find((item) => item.id === result);
      if (entry && state.user) {
        state.listPicker = entry;
        state.listMessage = "";
        if (entry.kind === "show") {
          state.expandedShowIds.add(entry.mediaId);
          try {
            state.showGuides[entry.mediaId] = await fetchShowGuide(entry.mediaId);
          } catch {
            // Guide loads when the show is opened.
          }
        }
      }
    }
  } catch (error) {
    state.catalogMessage = error instanceof Error ? error.message : "Could not change the catalog.";
  }

  state.catalogBusy = false;
  render(root);
}

async function runTmdbSearch(root: HTMLElement): Promise<void> {
  state.catalogBusy = true;
  state.catalogMessage = "";
  render(root);

  try {
    state.tmdbResults = await searchTmdb(state.sheetKind, state.tmdbQuery);
    if (state.tmdbResults.length === 0) {
      state.catalogMessage = "No horror, thriller, or mystery matches for that search.";
    }
  } catch (error) {
    state.tmdbResults = [];
    state.catalogMessage = error instanceof Error ? error.message : "Could not search TMDb.";
  }

  state.catalogBusy = false;
  render(root);
}

function render(root: HTMLElement): void {
  const standalone = isStandalone();
  root.innerHTML = `
    <div class="app">
      <main class="stage">
        ${state.view === "home" ? renderHome() : ""}
        ${state.view === "library" ? renderLibrary() : ""}
        ${state.view === "lists" ? renderLists() : ""}
        ${state.view === "account" ? renderAccount() : ""}
        ${state.view === "install" ? renderInstall(standalone) : ""}
      </main>
      ${state.view === "library" && state.user?.isAdmin ? `<button class="fab" type="button" data-action="open-add" aria-label="Add a title">+</button>` : ""}
      ${state.sheet && canRenderSheet() ? renderSheet() : ""}
      ${state.listPicker && state.user ? renderListPicker() : ""}
      ${!state.sheet && !state.listPicker && canPromptUpdate() ? renderUpdateBanner() : ""}
      <nav class="dock" aria-label="App">
        ${dockButton("home", "Home", homeIcon())}
        ${dockButton("library", "Library", libraryIcon())}
        ${dockButton("lists", "Lists", listsIcon())}
        ${dockButton("account", "Account", accountIcon())}
        ${standalone ? "" : dockButton("install", "Install", installIcon())}
      </nav>
    </div>
  `;
}

function renderUpdateBanner(): string {
  return `
    <aside class="update-banner" role="status">
      <p>A newer HorrorVerse is ready. Refresh to update?</p>
      <div class="update-banner-actions">
        <button class="update-banner-later" type="button" data-action="dismiss-update">Later</button>
        <button class="update-banner-refresh" type="button" data-action="apply-update">Refresh</button>
      </div>
    </aside>
  `;
}

function dockButton(view: View, label: string, icon: string): string {
  const active = state.view === view ? " is-active" : "";
  return `
    <button class="dock-btn${active}" type="button" data-action="view" data-view="${view}">
      ${icon}
      <span>${label}</span>
    </button>
  `;
}

function renderHome(): string {
  const total = state.entries.length;
  const completed = state.user ? state.entries.filter((entry) => isFinished(entry)).length : 0;

  return `
    <header class="masthead">
      <p class="eyebrow">Enter the HorrorVerse</p>
      <h1>HorrorVerse</h1>
      <div class="rule"></div>
      <p class="tagline">Every scream, every shadow, every story — all connected.</p>
      ${renderSignedInLine()}
    </header>
    ${renderStatus()}
    <section class="stats" aria-label="Library totals">
      <article>
        <strong>${total}</strong>
        <span>Tracked</span>
        <em>Every title in the catalog</em>
      </article>
      <article>
        <strong>${completed}</strong>
        <span>Finished</span>
        <em>${state.user ? "Marked as watched or read" : "Sign in to track what you've finished"}</em>
      </article>
      <article>
        <strong>${total - completed}</strong>
        <span>Still waiting</span>
        <em>${state.user ? "Left to watch or read" : "Your remaining titles appear after sign-in"}</em>
      </article>
    </section>
    ${renderFunStats()}
    <section class="kinds">
      ${MEDIA_KINDS.map((kind) => {
        const count = state.entries.filter((entry) => entry.kind === kind.id).length;
        return `
          <button class="kind-card" type="button" data-action="view" data-view="library" data-filter="${kind.id}">
            <span class="kind-count">${count}</span>
            <span class="kind-label">${kind.label}</span>
            <span class="kind-hint">${kind.hint}</span>
          </button>
        `;
      }).join("")}
    </section>
  `;
}

function renderFunStats(): string {
  if (state.entries.length < 1) {
    return "";
  }

  const stats = buildHorrorStats(state.entries, state.finishedIds, Boolean(state.user));
  return `
    <section class="fun-stats" aria-label="Time and vault stats">
      <h2>The numbers</h2>
      <p>${
        state.user
          ? "Your hours first, then the whole HorrorVerse — longest films, oldest titles, and nights in the vault."
          : "The whole HorrorVerse: how long the vault runs, plus the longest nights and oldest shadows."
      }</p>
      ${
        stats.yours
          ? renderStatGroup("Yours", "Runtime you've marked finished and the nights that were yours.", stats.yours)
          : `<p class="fun-stats-note"><button type="button" data-action="view" data-view="account">Sign in</button> to see your own hours and curiosities.</p>`
      }
      ${renderStatGroup("HorrorVerse", "Every title in the shared vault.", stats.vault)}
    </section>
  `;
}

function renderStatGroup(title: string, hint: string, group: StatGroup): string {
  return `
    <div class="fun-stats-group">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(hint)}</p>
      <div class="fun-stats-grid">${group.time.map((stat) => renderFunStat(stat)).join("")}</div>
      ${
        group.extras.length > 0
          ? `<div class="fun-stats-grid is-curiosities">${group.extras.map((stat) => renderFunStat(stat)).join("")}</div>`
          : ""
      }
      ${
        group.kinds.length > 0
          ? `<div class="fun-stats-grid is-kinds">${group.kinds.map((stat) => renderFunStat(stat)).join("")}</div>`
          : ""
      }
    </div>
  `;
}

function renderFunStat(stat: FunStat): string {
  const canOpen = Boolean(stat.filter || stat.query);
  const attrs = canOpen
    ? `data-action="stat-open" data-filter="${escapeHtml(stat.filter ?? "all")}" data-query="${escapeHtml(stat.query ?? "")}"`
    : "";
  const tag = canOpen ? "button" : "article";
  return `
    <${tag} class="fun-stat"${canOpen ? ` type="button" ${attrs}` : ""}>
      <strong>${escapeHtml(stat.value)}</strong>
      <span>${escapeHtml(stat.label)}</span>
      <em>${escapeHtml(stat.hint)}</em>
    </${tag}>
  `;
}

function renderSignedInLine(): string {
  if (!state.user) {
    return `<p class="session-line"><button type="button" data-action="view" data-view="account">Sign in</button> to keep your place in the vault.</p>`;
  }

  const role = state.user.isAdmin ? "Administrator" : "Member";
  return `<p class="session-line">Signed in as <strong>${escapeHtml(state.user.displayName)}</strong> · ${role}</p>`;
}

function renderLibrary(): string {
  const heading = state.filter === "all" ? "The vault" : MEDIA_KINDS.find((kind) => kind.id === state.filter)?.label ?? "The vault";
  const query = state.libraryQuery.trim();

  return `
    <header class="page-head">
      <h1>${escapeHtml(heading)}</h1>
      <p>${
        state.user
          ? state.user.isAdmin
            ? "Tap a title to mark it finished. Edit and delete stay with you."
            : "Tap a title to mark it finished, or add it to one of your lists."
          : "Sign in to mark titles finished and keep your own lists."
      }</p>
    </header>
    ${renderStatus()}
    ${state.catalogMessage ? `<p class="status is-error">${escapeHtml(state.catalogMessage)}</p>` : ""}
    <form class="library-search" data-library-search-form>
      <label class="library-search-field">
        <span class="library-search-label">Search</span>
        <input
          data-library-search
          type="search"
          value="${escapeHtml(state.libraryQuery)}"
          placeholder="Title, series, or year"
          autocomplete="off"
          enterkeyhint="search"
          aria-label="Search the vault"
        />
      </label>
      ${
        query
          ? `<button class="library-search-clear" type="button" data-action="clear-search" aria-label="Clear search">Clear</button>`
          : ""
      }
    </form>
    ${renderSearchKindRadios({
      name: "library-kind",
      selected: usesTmdb(state.filter as MediaKind) || state.filter === "all" ? state.filter : "",
      includeAll: true,
    })}
    <div class="chips" role="tablist" aria-label="Filter by type">
      ${MEDIA_KINDS.filter((kind) => !usesTmdb(kind.id)).map((kind) => chip(kind.id, kind.label)).join("")}
    </div>
    ${state.filter === "all" ? renderGroupedCatalog() : renderFlatCatalog()}
    ${state.status === "ready" ? renderTmdbCta() : ""}
  `;
}

function renderFlatCatalog(): string {
  const visible = matchingEntries().filter((entry) => entry.kind === state.filter);
  if (visible.length === 0) {
    return `<p class="empty">${emptyCopy()}</p>`;
  }

  if (state.filter === "movie") {
    return renderMoviesBySeries(visible, true);
  }

  return renderKindEntries(visible, true);
}

function renderGroupedCatalog(): string {
  const searching = Boolean(normalizeQuery(state.libraryQuery));
  const groups = MEDIA_KINDS.map((kind) => ({
    kind,
    entries: matchingEntries().filter((entry) => entry.kind === kind.id),
  })).filter((group) => group.entries.length > 0);

  if (groups.length === 0) {
    return `<p class="empty">${emptyCopy()}</p>`;
  }

  return groups
    .map((group) => {
      const open = searching || !state.collapsedKinds.has(group.kind.id);
      const body =
        group.kind.id === "movie"
          ? renderMoviesBySeries(group.entries, false)
          : renderKindEntries(group.entries, false);
      return `
        <details class="kind-group"${open ? " open" : ""}>
          <summary data-action="toggle-kind" data-kind="${group.kind.id}">
            <span class="kind-group-label">${escapeHtml(group.kind.label)}</span>
            <span class="kind-group-count">${group.entries.length}</span>
          </summary>
          ${body}
        </details>
      `;
    })
    .join("");
}

function renderMoviesBySeries(movies: CatalogEntry[], showKind: boolean): string {
  const grouped = groupMoviesBySeries(movies);
  const searching = Boolean(normalizeQuery(state.libraryQuery));
  const seriesMarkup = grouped.series
    .map((group) => {
      const open = searching || state.expandedSeriesIds.has(group.seriesId);
      return `
        <details class="list-series-group"${open ? " open" : ""}>
          <summary data-action="toggle-series" data-series-id="${group.seriesId}">
            <span class="list-series-label">${escapeHtml(group.title)}</span>
            <span class="list-series-count">${group.movies.length}</span>
          </summary>
          <ul class="catalog">${group.movies.map((movie) => renderEntry(movie, false, true)).join("")}</ul>
        </details>
      `;
    })
    .join("");
  const standaloneMarkup =
    grouped.standalone.length > 0
      ? `<ul class="catalog">${grouped.standalone.map((entry) => renderEntry(entry, showKind)).join("")}</ul>`
      : "";

  if (!seriesMarkup) {
    return standaloneMarkup;
  }

  return `<div class="list-entries">${seriesMarkup}${standaloneMarkup}</div>`;
}

function groupMoviesBySeries(movies: CatalogEntry[]): {
  series: { seriesId: number; title: string; movies: CatalogEntry[] }[];
  standalone: CatalogEntry[];
} {
  const groups = new Map<number, { seriesId: number; title: string; movies: CatalogEntry[] }>();
  const standalone: CatalogEntry[] = [];

  for (const movie of movies) {
    if (movie.seriesId === undefined) {
      standalone.push(movie);
      continue;
    }

    const existing = groups.get(movie.seriesId);
    if (existing) {
      existing.movies.push(movie);
      continue;
    }

    groups.set(movie.seriesId, { seriesId: movie.seriesId, title: seriesNameForMovie(movie), movies: [movie] });
  }

  return {
    series: [...groups.values()]
      .map((group) => ({ ...group, movies: sortByYear(group.movies) }))
      .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base", numeric: true })),
    standalone: sortByTitle(standalone),
  };
}

function seriesNameForMovie(movie: CatalogEntry): string {
  if (movie.seriesTitle) {
    return movie.seriesTitle;
  }

  const series = state.entries.find((entry) => entry.kind === "series" && entry.mediaId === movie.seriesId);
  return series?.title ?? "Series";
}

function matchingEntries(): CatalogEntry[] {
  const query = normalizeQuery(state.libraryQuery);
  if (!query) {
    return state.entries;
  }

  return state.entries.filter((entry) => matchesSearch(entry, query));
}

function matchesSearch(entry: CatalogEntry, query: string): boolean {
  const haystack = [
    entry.title,
    entry.seriesTitle ?? "",
    MEDIA_KINDS.find((kind) => kind.id === entry.kind)?.label ?? "",
    entry.releaseYear ? String(entry.releaseYear) : "",
    movieDetailLine(entry) ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function sortByTitle(entries: CatalogEntry[]): CatalogEntry[] {
  return [...entries].sort((left, right) => {
    const byTitle = left.title.localeCompare(right.title, undefined, { sensitivity: "base", numeric: true });
    if (byTitle !== 0) {
      return byTitle;
    }

    return compareByYearThenId(left, right);
  });
}

function sortByYear(entries: CatalogEntry[]): CatalogEntry[] {
  return [...entries].sort((left, right) => {
    const byYear = compareByYearThenId(left, right);
    if (byYear !== 0) {
      return byYear;
    }

    return left.title.localeCompare(right.title, undefined, { sensitivity: "base", numeric: true });
  });
}

function compareByYearThenId(left: CatalogEntry, right: CatalogEntry): number {
  const leftYear = left.releaseYear ?? Number.MAX_SAFE_INTEGER;
  const rightYear = right.releaseYear ?? Number.MAX_SAFE_INTEGER;
  if (leftYear !== rightYear) {
    return leftYear - rightYear;
  }

  return left.id.localeCompare(right.id);
}

function renderAccount(): string {
  if (state.user) {
    return `
      <header class="page-head">
        <h1>Account</h1>
        <p>${state.user.isAdmin ? "The vault answers to you." : "Your place in the HorrorVerse."}</p>
      </header>
      <section class="account-card">
        <p class="account-name">${escapeHtml(state.user.displayName)}</p>
        <p class="account-email">${escapeHtml(state.user.email)}</p>
        <span class="role-badge${state.user.isAdmin ? " is-admin" : ""}">${state.user.isAdmin ? "Admin" : "Member"}</span>
        ${
          state.user.isAdmin
            ? `<p class="account-note">You can add, edit, and remove titles in the library. Finished marks and lists are yours alone — other accounts keep their own.</p>`
            : `<p class="account-note">Mark titles finished and keep named lists. Only the administrator can change the catalog itself.</p>`
        }
        <button class="primary-btn" type="button" data-action="logout" ${state.authBusy ? "disabled" : ""}>Sign out</button>
      </section>
    `;
  }

  const register = state.authMode === "register";
  return `
    <header class="page-head">
      <h1>${register ? "Create account" : "Sign in"}</h1>
      <p>${register ? "Join the HorrorVerse as a member." : "Welcome back to the vault."}</p>
    </header>
    <div class="auth-toggle" role="tablist" aria-label="Account mode">
      <button class="chip${register ? "" : " is-active"}" type="button" data-action="auth-mode" data-mode="login">Sign in</button>
      <button class="chip${register ? " is-active" : ""}" type="button" data-action="auth-mode" data-mode="register">Register</button>
    </div>
    ${state.authMessage ? `<p class="status is-error">${escapeHtml(state.authMessage)}</p>` : ""}
    <form class="auth-form" data-auth-form="${register ? "register" : "login"}">
      ${
        register
          ? `
            <label>
              Display name
              <input name="displayName" type="text" maxlength="80" autocomplete="nickname" placeholder="How you appear in the vault" />
            </label>
          `
          : ""
      }
      <label>
        Email
        <input name="email" type="email" required autocomplete="email" />
      </label>
      <label>
        Password
        <input name="password" type="password" required minlength="8" autocomplete="${register ? "new-password" : "current-password"}" />
      </label>
      ${register ? `<p class="fine-print">New accounts are members. Only the HorrorVerse owner is an administrator.</p>` : ""}
      <button class="primary-btn" type="submit" ${state.authBusy ? "disabled" : ""}>${
        state.authBusy ? "Opening the gate…" : register ? "Create account" : "Sign in"
      }</button>
    </form>
  `;
}

function renderStatus(): string {
  if (state.status === "loading") {
    return `<p class="status">Opening the vault…</p>`;
  }

  if (state.status === "error") {
    return `
      <p class="status is-error">Could not reach the API. Start HorrorTracker.Api, then retry.</p>
      <button class="primary-btn" type="button" data-action="reload">Try again</button>
    `;
  }

  return "";
}

function emptyCopy(): string {
  if (state.status === "loading") {
    return "Loading titles…";
  }

  if (state.status === "error") {
    return "The catalog is unreachable until the API is running.";
  }

  const query = state.libraryQuery.trim();
  if (query) {
    return `No titles match “${escapeHtml(query)}”.`;
  }

  return "Nothing in this part of the vault yet.";
}

function renderTmdbCta(): string {
  if (!state.user) {
    if (!state.libraryQuery.trim()) {
      return "";
    }

    return `<p class="tmdb-cta">Don't see your movie? <button type="button" data-action="open-tmdb">Sign in to add it</button></p>`;
  }

  return `<p class="tmdb-cta">Don't see your movie? <button type="button" data-action="open-tmdb">Add it</button></p>`;
}

function chip(filter: LibraryFilter, label: string): string {
  const active = state.filter === filter ? " is-active" : "";
  return `<button class="chip${active}" type="button" data-action="filter" data-filter="${filter}">${label}</button>`;
}

function renderSearchKindRadios(options: {
  name: string;
  selected: string;
  includeAll?: boolean;
  disabled?: boolean;
  sheetKind?: boolean;
}): string {
  const kinds = [
    ...(options.includeAll ? [{ id: "all", label: "All" }] : []),
    ...MEDIA_KINDS.filter((kind) => usesTmdb(kind.id)),
  ];
  return `
    <fieldset class="search-kinds">
      <legend>${options.sheetKind ? "Looking for" : "Search in"}</legend>
      ${kinds
        .map((kind) => {
          const attrs = options.sheetKind ? "data-sheet-kind" : "data-library-kind";
          return `
            <label>
              <input type="radio" name="${escapeHtml(options.name)}" value="${escapeHtml(kind.id)}" ${attrs} ${kind.id === options.selected ? "checked" : ""} ${options.disabled ? "disabled" : ""} />
              ${escapeHtml(kind.label)}
            </label>
          `;
        })
        .join("")}
    </fieldset>
  `;
}

function renderKindEntries(entries: CatalogEntry[], showKind: boolean): string {
  if (state.user && entries.some((entry) => entry.kind === "show")) {
    return `<div class="list-entries">${sortByTitle(entries).map((entry) => renderCatalogRow(entry, showKind)).join("")}</div>`;
  }

  return `<ul class="catalog">${sortByTitle(entries).map((entry) => renderEntry(entry, showKind)).join("")}</ul>`;
}

function renderCatalogRow(entry: CatalogEntry, showKind = true, nested = false): string {
  if (entry.kind === "show" && state.user) {
    return renderShowGuide(entry, { showKind });
  }

  return renderEntry(entry, showKind, nested);
}

function renderListStandalone(entries: CatalogEntry[], listId: number): string {
  if (entries.some((entry) => entry.kind === "show")) {
    return `<div class="list-entries">${entries.map((entry) => (entry.kind === "show" ? renderShowGuide(entry, { listId }) : `<ul class="catalog">${renderListItem(entry, listId)}</ul>`)).join("")}</div>`;
  }

  return `<ul class="catalog">${entries.map((entry) => renderListItem(entry, listId)).join("")}</ul>`;
}

function renderShowGuide(entry: CatalogEntry, options: { showKind?: boolean; listId?: number }): string {
  const showId = entry.mediaId;
  const guide = state.showGuides[showId];
  const open = state.expandedShowIds.has(showId);
  const done = isFinished(entry);
  const details = movieDetailLine(entry);
  const subtitle = [details ?? (options.showKind === false ? "" : "TV Show"), showProgressLabel(guide)].filter(Boolean).join(" · ");
  const admin = Boolean(state.user?.isAdmin);
  return `
    <details class="list-series-group show-guide${done ? " is-done" : ""}"${open ? " open" : ""}>
      <summary data-action="toggle-show" data-show-id="${showId}">
        <span class="mark" aria-hidden="true"></span>
        <span class="list-series-label">
          <strong>${escapeHtml(entry.title)}</strong>
          ${subtitle ? `<em>${escapeHtml(subtitle)}</em>` : ""}
        </span>
        <span class="list-series-count">${guide ? `${guide.seasons.length} season${guide.seasons.length === 1 ? "" : "s"}` : "Seasons"}</span>
      </summary>
      <div class="show-toolbar">
        <button class="ghost-btn" type="button" data-action="toggle" data-id="${escapeHtml(entry.id)}" ${state.catalogBusy ? "disabled" : ""}>${done ? "Unmark show" : "Mark show"}</button>
        ${
          options.listId === undefined
            ? `<button class="entry-list" type="button" data-action="open-lists" data-id="${escapeHtml(entry.id)}" ${state.catalogBusy ? "disabled" : ""}>List</button>`
            : `<button class="entry-remove" type="button" data-action="toggle-list-item" data-list-id="${options.listId}" data-id="${escapeHtml(entry.id)}" aria-label="Remove ${escapeHtml(entry.title)}" ${state.catalogBusy ? "disabled" : ""}>×</button>`
        }
        ${
          admin && options.listId === undefined
            ? `
              <button class="entry-edit" type="button" data-action="open-edit" data-id="${escapeHtml(entry.id)}" ${state.catalogBusy ? "disabled" : ""}>Edit</button>
              <button class="entry-remove" type="button" data-action="delete" data-id="${escapeHtml(entry.id)}" aria-label="Remove ${escapeHtml(entry.title)}" ${state.catalogBusy ? "disabled" : ""}>×</button>
            `
            : ""
        }
      </div>
      ${open ? renderShowSeasons(showId, guide) : ""}
    </details>
  `;
}

function renderShowSeasons(showId: number, guide: ShowGuide | undefined): string {
  if (!guide) {
    return `<p class="empty">Loading seasons…</p>`;
  }

  if (guide.seasons.length === 0) {
    return `<p class="empty">No seasons found for this show yet.</p>`;
  }

  return guide.seasons
    .map((season) => {
      const open = state.expandedShowSeasons.has(showSeasonKey(showId, season.seasonNumber));
      const seasonDone = season.loaded && season.episodeCount > 0 && season.finishedCount >= season.episodeCount;
      const count = season.episodeCount > 0 ? `${season.finishedCount}/${season.episodeCount}` : "…";
      return `
        <details class="list-series-group show-season"${open ? " open" : ""}>
          <summary data-action="toggle-show-season" data-show-id="${showId}" data-season-number="${season.seasonNumber}">
            <span class="list-series-label">${escapeHtml(season.title)}</span>
            <span class="list-series-count">${escapeHtml(count)}</span>
          </summary>
          <div class="show-toolbar">
            <button class="ghost-btn" type="button" data-action="toggle-season" data-season-id="${season.id}" data-completed="${seasonDone ? "true" : "false"}" ${state.catalogBusy ? "disabled" : ""}>${
              seasonDone ? "Clear season" : "Mark season"
            }</button>
          </div>
          ${open ? renderShowEpisodes(season.loaded, season.episodes) : ""}
        </details>
      `;
    })
    .join("");
}

function renderShowEpisodes(loaded: boolean, episodes: ShowGuide["seasons"][number]["episodes"]): string {
  if (!loaded) {
    return `<p class="empty">Loading episodes…</p>`;
  }

  if (episodes.length === 0) {
    return `<p class="empty">No episodes in this season.</p>`;
  }

  return `<ul class="catalog">${episodes
    .map((episode) => {
      const details = [episode.year ? String(episode.year) : "", formatRuntime(episode.runtime) ?? ""].filter(Boolean).join(" · ");
      return `
        <li class="entry${episode.completed ? " is-done" : ""} is-nested">
          <button class="entry-toggle" type="button" data-action="toggle-episode" data-episode-id="${episode.id}" data-completed="${episode.completed ? "true" : "false"}" ${state.catalogBusy ? "disabled" : ""}>
            <span class="mark" aria-hidden="true"></span>
            <span class="entry-copy">
              <strong>${episode.episodeNumber}. ${escapeHtml(episode.title)}</strong>
              ${details ? `<em>${escapeHtml(details)}</em>` : ""}
            </span>
          </button>
        </li>
      `;
    })
    .join("")}</ul>`;
}

function showProgressLabel(guide: ShowGuide | undefined): string {
  if (!guide) {
    return "";
  }

  const episodes = guide.seasons.reduce((total, season) => total + season.episodeCount, 0);
  const finished = guide.seasons.reduce((total, season) => total + season.finishedCount, 0);
  if (episodes === 0) {
    return "";
  }

  return `${finished} of ${episodes} episodes`;
}

function renderEntry(entry: CatalogEntry, showKind = true, nested = false): string {
  const kindLabel = MEDIA_KINDS.find((kind) => kind.id === entry.kind)?.label ?? entry.kind;
  const details = nested ? movieDetailLine({ ...entry, seriesTitle: undefined }) : movieDetailLine(entry);
  const subtitle = details ?? (showKind ? kindLabel : "");
  const admin = Boolean(state.user?.isAdmin);
  const signedIn = Boolean(state.user);
  const done = isFinished(entry);
  const body = `
    <span class="mark" aria-hidden="true"></span>
    <span class="entry-copy">
      <strong>${escapeHtml(entry.title)}</strong>
      ${subtitle ? `<em>${escapeHtml(subtitle)}</em>` : ""}
    </span>
  `;

  return `
    <li class="entry${done ? " is-done" : ""}${nested ? " is-nested" : ""}">
      <button class="entry-toggle" type="button" data-action="toggle" data-id="${escapeHtml(entry.id)}" ${state.catalogBusy ? "disabled" : ""}>${body}</button>
      ${
        signedIn
          ? `<button class="entry-list" type="button" data-action="open-lists" data-id="${escapeHtml(entry.id)}" aria-label="Add ${escapeHtml(entry.title)} to a list" ${state.catalogBusy ? "disabled" : ""}>List</button>`
          : ""
      }
      ${
        admin
          ? `
            <button class="entry-edit" type="button" data-action="open-edit" data-id="${escapeHtml(entry.id)}" aria-label="Edit ${escapeHtml(entry.title)}" ${state.catalogBusy ? "disabled" : ""}>Edit</button>
            <button class="entry-remove" type="button" data-action="delete" data-id="${escapeHtml(entry.id)}" aria-label="Remove ${escapeHtml(entry.title)}" ${state.catalogBusy ? "disabled" : ""}>×</button>
          `
          : ""
      }
    </li>
  `;
}

function renderLists(): string {
  if (!state.user) {
    return `
      <header class="page-head">
        <h1>Lists</h1>
        <p>Keep Watch Later, favorites, or an October marathon — yours alone.</p>
      </header>
      <p class="empty">Sign in to create lists.</p>
      <button class="primary-btn" type="button" data-action="view" data-view="account">Sign in</button>
    `;
  }

  return `
    <header class="page-head">
      <h1>Lists</h1>
      <p>Named lists for this account. Other people cannot see them.</p>
    </header>
    ${state.listMessage ? `<p class="status is-error">${escapeHtml(state.listMessage)}</p>` : ""}
    <form class="list-create" data-list-form>
      <label>
        New list
        <input name="name" type="text" required maxlength="80" placeholder="Watch later, October 2026…" autocomplete="off" />
      </label>
      <button class="primary-btn" type="submit" ${state.catalogBusy ? "disabled" : ""}>Create</button>
    </form>
    ${
      state.lists.length === 0
        ? `<p class="empty">No lists yet. Create one, then add titles from the library.</p>`
        : state.lists.map((list) => renderUserList(list)).join("")
    }
  `;
}

function renderUserList(list: UserList): string {
  const grouped = groupListEntries(list);
  const empty = grouped.series.length === 0 && grouped.standalone.length === 0;

  return `
    <details class="user-list" open>
      <summary>
        <span class="user-list-name">${escapeHtml(list.name)}</span>
        <span class="user-list-count">${grouped.total}</span>
      </summary>
      <div class="user-list-actions">
        <button type="button" data-action="rename-list" data-list-id="${list.id}" ${state.catalogBusy ? "disabled" : ""}>Rename</button>
        <button type="button" data-action="delete-list" data-list-id="${list.id}" ${state.catalogBusy ? "disabled" : ""}>Delete</button>
      </div>
      ${
        empty
          ? `<p class="empty">Nothing in this list yet. Open the library and tap List.</p>`
          : `<div class="list-entries">${grouped.series.map((group) => renderListSeries(group, list.id)).join("")}${
              grouped.standalone.length > 0
                ? renderListStandalone(grouped.standalone, list.id)
                : ""
            }</div>`
      }
    </details>
  `;
}

function groupListEntries(list: UserList): {
  series: { series: CatalogEntry; movies: CatalogEntry[] }[];
  standalone: CatalogEntry[];
  total: number;
} {
  const entries = list.items
    .map((id) => state.entries.find((entry) => entry.id === id))
    .filter((entry): entry is CatalogEntry => Boolean(entry));
  const series = sortByTitle(entries.filter((entry) => entry.kind === "series"));
  const nestedIds = new Set<string>();
  const groups = series.map((item) => {
    const movies = sortByYear(
      entries.filter((entry) => entry.kind === "movie" && entry.seriesId === item.mediaId),
    );
    for (const movie of movies) {
      nestedIds.add(movie.id);
    }

    return { series: item, movies };
  });
  const standalone = sortByTitle(entries.filter((entry) => entry.kind !== "series" && !nestedIds.has(entry.id)));
  return { series: groups, standalone, total: entries.length };
}

function renderListSeries(group: { series: CatalogEntry; movies: CatalogEntry[] }, listId: number): string {
  const expanded = state.expandedListSeries.has(listSeriesKey(listId, group.series.mediaId));
  return `
    <div class="list-series">
      <ul class="catalog">${renderListItem(group.series, listId)}</ul>
      ${
        group.movies.length > 0
          ? `
            <details class="list-series-group"${expanded ? " open" : ""}>
              <summary data-action="toggle-list-series" data-list-id="${listId}" data-series-id="${group.series.mediaId}">
                <span class="list-series-label">Movies</span>
                <span class="list-series-count">${group.movies.length}</span>
              </summary>
              <ul class="catalog">${group.movies.map((movie) => renderListItem(movie, listId, true)).join("")}</ul>
            </details>
          `
          : ""
      }
    </div>
  `;
}

function listSeriesKey(listId: number | string | undefined, seriesId: number | string | undefined): string {
  const list = Number(listId);
  const series = Number(seriesId);
  return Number.isInteger(list) && Number.isInteger(series) ? `${list}:${series}` : "";
}

function renderListItem(entry: CatalogEntry, listId: number, nested = false): string {
  const details = nested ? movieDetailLine({ ...entry, seriesTitle: undefined }) : movieDetailLine(entry);
  const subtitle = details ?? (nested ? "" : MEDIA_KINDS.find((kind) => kind.id === entry.kind)?.label ?? entry.kind);
  return `
    <li class="entry${isFinished(entry) ? " is-done" : ""}${nested ? " is-nested" : ""}">
      <button class="entry-toggle" type="button" data-action="toggle" data-id="${escapeHtml(entry.id)}" ${state.catalogBusy ? "disabled" : ""}>
        <span class="mark" aria-hidden="true"></span>
        <span class="entry-copy">
          <strong>${escapeHtml(entry.title)}</strong>
          ${subtitle ? `<em>${escapeHtml(subtitle)}</em>` : ""}
        </span>
      </button>
      <button class="entry-remove" type="button" data-action="toggle-list-item" data-list-id="${listId}" data-id="${escapeHtml(entry.id)}" aria-label="Remove ${escapeHtml(entry.title)}" ${state.catalogBusy ? "disabled" : ""}>×</button>
    </li>
  `;
}

function renderListPicker(): string {
  if (!state.listPicker) {
    return "";
  }

  const entry = state.listPicker;
  return `
    <div class="sheet-backdrop" data-action="close-lists"></div>
    <div class="sheet" role="dialog" aria-label="Add to a list">
      <h2>${escapeHtml(entry.title)}</h2>
      <p class="fine-print">${
        entry.kind === "series"
          ? "Movies in this series are added with it, under a dropdown."
          : "Choose the lists this title belongs on."
      }</p>
      ${state.listMessage ? `<p class="status is-error">${escapeHtml(state.listMessage)}</p>` : ""}
      ${
        state.lists.length === 0
          ? `<p class="empty">Create a list first.</p>`
          : `<ul class="list-picker">${state.lists
              .map((list) => {
                const on = list.items.includes(entry.id);
                return `
                  <li>
                    <button class="list-pick${on ? " is-on" : ""}" type="button" data-action="toggle-list-item" data-list-id="${list.id}" data-id="${escapeHtml(entry.id)}" ${state.catalogBusy ? "disabled" : ""}>
                      <span class="mark" aria-hidden="true"></span>
                      <span>${escapeHtml(list.name)}</span>
                    </button>
                  </li>
                `;
              })
              .join("")}</ul>`
      }
      <form class="list-create is-compact" data-list-form>
        <label>
          New list
          <input name="name" type="text" required maxlength="80" placeholder="Favorites" autocomplete="off" />
        </label>
        <button class="primary-btn" type="submit" ${state.catalogBusy ? "disabled" : ""}>Create</button>
      </form>
      <div class="sheet-actions">
        <button class="ghost-btn" type="button" data-action="close-lists">Done</button>
      </div>
    </div>
  `;
}

function isFinished(entry: CatalogEntry): boolean {
  return state.finishedIds.includes(entry.id);
}

function renderSheet(): string {
  if (!state.sheet) {
    return "";
  }

  if (state.sheet.mode === "tmdb") {
    return renderTmdbSheet();
  }

  const editing = state.sheet.mode === "edit";
  const entry = state.sheet.entry;
  const selectedKind = editing ? (entry?.kind ?? "movie") : state.sheetKind;
  const tmdbEnabled = !editing && usesTmdb(selectedKind);

  return `
    <div class="sheet-backdrop" data-action="close-sheet"></div>
    <div class="sheet">
      <h2>${editing ? "Edit title" : "Add a title"}</h2>
      ${state.catalogMessage ? `<p class="status is-error">${escapeHtml(state.catalogMessage)}</p>` : ""}
      ${
        editing
          ? ""
          : `
            <label>
              Type
              <select data-sheet-kind ${state.catalogBusy ? "disabled" : ""}>
                ${WRITABLE_KINDS.map((kind) => `<option value="${kind.id}" ${kind.id === selectedKind ? "selected" : ""}>${kind.label}</option>`).join("")}
              </select>
            </label>
          `
      }
      ${tmdbEnabled ? `${renderTmdbSearch(selectedKind)}<p class="tmdb-or">Or enter it yourself</p>` : ""}
      <form data-catalog-form="${state.sheet.mode}">
        <label>
          Title
          <input name="title" type="text" required maxlength="200" value="${escapeHtml(entry?.title ?? "")}" />
        </label>
        ${
          editing
            ? `<input type="hidden" name="kind" value="${escapeHtml(selectedKind)}" />`
            : ""
        }
        ${
          editing
            ? ""
            : `
              <label>
                Release year
                <input name="releaseYear" type="number" min="1888" max="3000" inputmode="numeric" placeholder="Optional" />
              </label>
            `
        }
        <label class="sheet-check">
          <input name="completed" type="checkbox" ${entry?.completed ? "checked" : ""} />
          Watched in catalog
        </label>
        <p class="fine-print">Used by the desktop apps. Your personal finished mark lives on the title in the library.</p>
        <div class="sheet-actions">
          <button class="ghost-btn" type="button" data-action="close-sheet">Cancel</button>
          <button class="primary-btn" type="submit" ${state.catalogBusy ? "disabled" : ""}>${state.catalogBusy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  `;
}

function renderTmdbSheet(): string {
  const selectedKind = usesTmdb(state.sheetKind) ? state.sheetKind : "movie";
  return `
    <div class="sheet-backdrop" data-action="close-sheet"></div>
    <div class="sheet">
      <h2>Add a missing title</h2>
      <p class="fine-print">Search TMDb. We'll add it to the shared vault, then you can put it on your lists.</p>
      ${state.catalogMessage ? `<p class="status is-error">${escapeHtml(state.catalogMessage)}</p>` : ""}
      ${renderTmdbSearch(selectedKind)}
      <div class="sheet-actions">
        <button class="ghost-btn" type="button" data-action="close-sheet">Cancel</button>
      </div>
    </div>
  `;
}

function renderTmdbSearch(selectedKind: MediaKind): string {
  return `
    <form data-tmdb-form>
      ${renderSearchKindRadios({
        name: "tmdb-kind",
        selected: selectedKind,
        disabled: state.catalogBusy,
        sheetKind: true,
      })}
      <label>
        Search TMDb
        <input name="q" type="search" value="${escapeHtml(state.tmdbQuery)}" maxlength="120" placeholder="${tmdbPlaceholder(selectedKind)}" autocomplete="off" ${state.catalogBusy ? "disabled" : ""} />
      </label>
      <p class="fine-print">${tmdbHint(selectedKind)}</p>
      <button class="primary-btn tmdb-search-btn" type="submit" ${state.catalogBusy ? "disabled" : ""}>${state.catalogBusy ? "Working…" : "Search TMDb"}</button>
    </form>
    ${
      state.tmdbResults.length > 0
        ? `<ul class="tmdb-results">${state.tmdbResults
            .map(
              (hit) => `
                <li>
                  <button class="tmdb-hit" type="button" data-action="import-tmdb" data-tmdb-id="${hit.tmdbId}" ${state.catalogBusy ? "disabled" : ""}>
                    <strong>${escapeHtml(hit.title)}${hit.year ? ` (${hit.year})` : ""}</strong>
                    ${hit.overview ? `<em>${escapeHtml(hit.overview)}</em>` : ""}
                  </button>
                </li>
              `,
            )
            .join("")}</ul>`
        : ""
    }
  `;
}

function usesTmdb(kind: MediaKind): boolean {
  return kind === "movie" || kind === "series" || kind === "documentary" || kind === "show";
}

function canUseTmdbSheet(): boolean {
  if (!state.sheet || !usesTmdb(state.sheetKind)) {
    return false;
  }

  if (state.sheet.mode === "tmdb") {
    return Boolean(state.user);
  }

  return state.sheet.mode === "add" && Boolean(state.user?.isAdmin);
}

function canRenderSheet(): boolean {
  if (!state.sheet || !state.user) {
    return false;
  }

  return state.sheet.mode === "tmdb" || Boolean(state.user.isAdmin);
}

function defaultSheetKind(): MediaKind {
  return WRITABLE_KINDS.some((kind) => kind.id === state.filter) ? (state.filter as MediaKind) : "movie";
}

function defaultTmdbKind(): MediaKind {
  return isMediaKind(state.filter) && usesTmdb(state.filter) ? state.filter : "movie";
}

function tmdbPlaceholder(kind: MediaKind): string {
  switch (kind) {
    case "series":
      return "Scream Collection";
    case "show":
      return "American Horror Story";
    case "documentary":
      return "Living with Chucky";
    default:
      return "Scream";
  }
}

function tmdbHint(kind: MediaKind): string {
  switch (kind) {
    case "series":
      return "Horror, thriller, and mystery collections, with their movies in release order.";
    case "show":
      return "Horror, thriller, and mystery TV shows — not films that share the same title.";
    case "documentary":
      return "Titles TMDb tags as documentary, such as Living with Chucky. Those do not appear under Movies.";
    default:
      return "Horror, thriller, and mystery feature films. Documentaries and TV shows stay on those radios.";
  }
}

function renderInstall(standalone: boolean): string {
  if (standalone) {
    return `
      <header class="page-head">
        <h1>Installed</h1>
        <p>HorrorVerse is running as an app on this device.</p>
      </header>
    `;
  }

  const androidPrompt = canPromptInstall();
  const ios = isIosDevice();

  return `
    <header class="page-head">
      <h1>Save this app</h1>
      <p>Install HorrorVerse to your home screen. No store, no fee — just a webpage that behaves like an app.</p>
    </header>
    ${
      androidPrompt
        ? `<button class="primary-btn" type="button" data-action="install">Install HorrorVerse</button>`
        : ""
    }
    <ol class="install-steps">
      ${
        ios
          ? `
            <li>Open this page in <strong>Safari</strong>.</li>
            <li>Tap the <strong>Share</strong> button.</li>
            <li>Choose <strong>Add to Home Screen</strong>.</li>
            <li>Tap <strong>Add</strong>. HorrorVerse appears with its own icon.</li>
          `
          : `
            <li>Open this page in <strong>Chrome</strong> or <strong>Edge</strong>.</li>
            <li>Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
            <li>Confirm. HorrorVerse launches full-screen from your home screen.</li>
          `
      }
    </ol>
    <p class="fine-print">Phones need HTTPS (or localhost) for a true installable app. Use <code>npm run dev:https</code> when testing on a real device. The API must also be reachable from the phone.</p>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function homeIcon(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/></svg>`;
}

function libraryIcon(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4v16H5zm5 2h9v3H10zm0 5h9v3H10zm0 5h9v4H10z"/></svg>`;
}

function accountIcon(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5z"/></svg>`;
}

function listsIcon(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14v2H5zm0 5h14v2H5zm0 5h10v2H5z"/></svg>`;
}

function installIcon(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3h2v9.2l2.6-2.6 1.4 1.4L12 16 7 10.99l1.4-1.4L11 12.2zm-6 13h2v3h10v-3h2v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/></svg>`;
}
