import { fetchCatalog, MEDIA_KINDS, type CatalogEntry, type MediaKind } from "./catalog";
import {
  fetchCurrentUser,
  loginAccount,
  logoutAccount,
  registerAccount,
  type AuthUser,
} from "./auth";
import { canPromptInstall, isIosDevice, isStandalone, onInstallAvailabilityChange, promptInstall } from "./pwa";

type View = "home" | "library" | "account" | "install";
type LibraryFilter = MediaKind | "all";
type LoadStatus = "loading" | "ready" | "error";
type AuthMode = "login" | "register";

interface AppState {
  view: View;
  filter: LibraryFilter;
  entries: CatalogEntry[];
  status: LoadStatus;
  user: AuthUser | null;
  authMode: AuthMode;
  authMessage: string;
  authBusy: boolean;
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
};

export function mountApp(root: HTMLElement): void {
  render(root);
  onInstallAvailabilityChange(() => render(root));
  void refreshCatalog(root);
  void refreshUser(root);

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
      render(root);
      return;
    }

    if (action === "filter") {
      state.filter = target.dataset.filter as LibraryFilter;
      render(root);
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
      state.authBusy = false;
      state.authMessage = "";
      render(root);
      return;
    }

    if (action === "install") {
      await promptInstall();
      render(root);
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
    } catch (error) {
      state.authMessage = error instanceof Error ? error.message : "Could not sign in.";
    }

    state.authBusy = false;
    render(root);
  });
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
  render(root);
}

function render(root: HTMLElement): void {
  const standalone = isStandalone();
  root.innerHTML = `
    <div class="app">
      <main class="stage">
        ${state.view === "home" ? renderHome() : ""}
        ${state.view === "library" ? renderLibrary() : ""}
        ${state.view === "account" ? renderAccount() : ""}
        ${state.view === "install" ? renderInstall(standalone) : ""}
      </main>
      <nav class="dock" aria-label="App">
        ${dockButton("home", "Home", homeIcon())}
        ${dockButton("library", "Library", libraryIcon())}
        ${dockButton("account", "Account", accountIcon())}
        ${standalone ? "" : dockButton("install", "Install", installIcon())}
      </nav>
    </div>
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
  const completed = state.entries.filter((entry) => entry.completed).length;

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
        <em>Marked as watched or read</em>
      </article>
      <article>
        <strong>${total - completed}</strong>
        <span>Still waiting</span>
        <em>Left to watch or read</em>
      </article>
    </section>
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

function renderSignedInLine(): string {
  if (!state.user) {
    return `<p class="session-line"><button type="button" data-action="view" data-view="account">Sign in</button> to keep your place in the vault.</p>`;
  }

  const role = state.user.isAdmin ? "Administrator" : "Member";
  return `<p class="session-line">Signed in as <strong>${escapeHtml(state.user.displayName)}</strong> · ${role}</p>`;
}

function renderLibrary(): string {
  const visible = state.filter === "all" ? state.entries : state.entries.filter((entry) => entry.kind === state.filter);
  const heading = state.filter === "all" ? "The vault" : MEDIA_KINDS.find((kind) => kind.id === state.filter)?.label ?? "The vault";

  return `
    <header class="page-head">
      <h1>${escapeHtml(heading)}</h1>
      <p>Live from the HorrorTracker catalog.</p>
    </header>
    ${renderStatus()}
    <div class="chips" role="tablist" aria-label="Filter by type">
      ${chip("all", "All")}
      ${MEDIA_KINDS.map((kind) => chip(kind.id, kind.label)).join("")}
    </div>
    ${
      visible.length === 0
        ? `<p class="empty">${emptyCopy()}</p>`
        : `<ul class="catalog">${visible.map(renderEntry).join("")}</ul>`
    }
  `;
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
            ? `<p class="account-note">You are the only administrator. Other people can register as members.</p>`
            : `<p class="account-note">Members can sign in and follow the catalog. Admin tools come next.</p>`
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

  return "Nothing in this part of the vault yet.";
}

function chip(filter: LibraryFilter, label: string): string {
  const active = state.filter === filter ? " is-active" : "";
  return `<button class="chip${active}" type="button" data-action="filter" data-filter="${filter}">${label}</button>`;
}

function renderEntry(entry: CatalogEntry): string {
  const kindLabel = MEDIA_KINDS.find((kind) => kind.id === entry.kind)?.label ?? entry.kind;
  return `
    <li class="entry${entry.completed ? " is-done" : ""}">
      <div class="entry-toggle">
        <span class="mark" aria-hidden="true"></span>
        <span class="entry-copy">
          <strong>${escapeHtml(entry.title)}</strong>
          <em>${kindLabel}</em>
        </span>
      </div>
    </li>
  `;
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

function installIcon(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3h2v9.2l2.6-2.6 1.4 1.4L12 16 7 10.99l1.4-1.4L11 12.2zm-6 13h2v3h10v-3h2v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/></svg>`;
}
