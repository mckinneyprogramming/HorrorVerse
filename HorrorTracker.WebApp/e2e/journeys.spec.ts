import { expect, type Page, test } from "@playwright/test";

type User = { id: number; email: string; displayName: string; isAdmin: boolean };
type List = { id: number; name: string; items: string[]; visibility: "private" };

type Vault = {
  user: User | null;
  ids: string[];
  lists: List[];
};

const catalog = [
  { id: "movie:3", mediaId: 3, title: "Orphan", kind: "movie", completed: false, releaseYear: 2009, totalTime: 123 },
  {
    id: "show:4",
    mediaId: 4,
    title: "The Zone",
    kind: "show",
    completed: false,
    releaseYear: 2019,
    totalTime: 500,
    totalEpisodes: 10,
    numberOfSeasons: 1,
  },
];

const member: User = { id: 2, email: "bo@vault.test", displayName: "Bo", isAdmin: false };

function emptyProgress(ids: string[]) {
  return {
    ids,
    recentIds: ids,
    undatedIds: [],
    watchedYears: {},
    scores: {},
    recentPosters: {},
    watchNext: [],
    readNext: [],
  };
}

async function installVault(page: Page, vault: Vault) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const body = method === "GET" || method === "DELETE" ? {} : ((request.postDataJSON() as Record<string, unknown>) ?? {});
    const json = (payload: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });

    if (path === "/api/health") return json({ status: "ok" });
    if (path === "/api/catalog") return json(catalog);
    if (path === "/api/upcoming") return json({ films: [], shows: [] });
    if (path === "/api/franchises") return json({ franchises: [] });
    if (path === "/api/sync") return json({ added: 0, postersFilled: 0 });
    if (path === "/api/friends") return json({ friends: [], incoming: [], outgoing: [], following: [] });
    if (path === "/api/people") return json({ people: [], person: null });
    if (path === "/api/shows") {
      return json({
        id: "show:4",
        showId: 4,
        seasons: [
          {
            id: 1,
            seasonNumber: 1,
            title: "Season 1",
            episodeCount: 1,
            finishedCount: 0,
            loaded: true,
            episodes: [{ id: 10, episodeNumber: 1, title: "Pilot", runtime: 45, completed: false }],
          },
        ],
      });
    }
    if (path === "/api/auth" && method === "GET") return json({ user: vault.user });
    if (path === "/api/auth" && method === "POST") {
      vault.user = member;
      return json({ user: vault.user });
    }
    if (path === "/api/progress" && method === "GET") {
      return vault.user ? json(emptyProgress(vault.ids)) : json({ error: "Sign in." }, 401);
    }
    if (path === "/api/progress" && method === "PATCH") {
      if (body.completed === true && typeof body.id === "string" && !vault.ids.includes(body.id)) vault.ids.push(body.id);
      if (body.completed === false && typeof body.id === "string") vault.ids = vault.ids.filter((id) => id !== body.id);
      return json(emptyProgress(vault.ids));
    }
    if (path === "/api/lists" && method === "GET") return json({ lists: vault.lists });
    if (path === "/api/lists" && method === "POST" && !body.itemId) {
      vault.lists.push({ id: 8, name: String(body.name ?? "List"), items: [], visibility: "private" });
      return json({ lists: vault.lists });
    }
    if (path === "/api/lists" && method === "POST") {
      const list = vault.lists.find((item) => item.id === Number(body.listId)) ?? vault.lists[0];
      if (list && typeof body.itemId === "string" && !list.items.includes(body.itemId)) list.items.push(body.itemId);
      return json({ lists: vault.lists });
    }
    return json({});
  });
}

async function openDock(page: Page, view: string) {
  await page.locator(`nav.dock [data-view="${view}"]`).click();
}

async function chooseKind(page: Page, name: "Movies" | "TV Shows") {
  await page.getByRole("radio", { name }).click();
}

test("signs in", async ({ page }) => {
  const vault: Vault = { user: null, ids: [], lists: [] };
  await installVault(page, vault);
  await page.goto("/");
  await openDock(page, "account");
  await page.locator('input[name="email"]').fill("bo@vault.test");
  await page.locator('input[name="password"]').fill("vault-key");
  await page.locator("[data-auth-form]").getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".account-name")).toHaveText("Bo");
});

test("marks a title watched and shows it in the numbers", async ({ page }) => {
  const vault: Vault = { user: member, ids: [], lists: [] };
  await installVault(page, vault);
  await page.goto("/library");
  await chooseKind(page, "Movies");
  await page.locator('[data-action="toggle"][data-id="movie:3"]').click();
  await openDock(page, "account");
  await page.getByRole("button", { name: "The numbers" }).click();
  await expect(page.getByRole("heading", { name: "The numbers" })).toBeVisible();
  await expect(page.getByText("Hours survived")).toBeVisible();
});

test("creates a list and adds a title", async ({ page }) => {
  const vault: Vault = { user: member, ids: [], lists: [] };
  await installVault(page, vault);
  await page.goto("/lists");
  await page.locator('[data-list-form] input[name="name"]').fill("October");
  await page.locator("[data-list-form]").getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("October")).toBeVisible();
  await openDock(page, "library");
  await chooseKind(page, "Movies");
  await page.locator('[data-action="open-lists"][data-id="movie:3"]').click();
  await page.getByRole("button", { name: "October" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await openDock(page, "lists");
  await expect(page.getByText("Orphan")).toBeVisible();
});

test("opens a show guide", async ({ page }) => {
  const vault: Vault = { user: member, ids: [], lists: [] };
  await installVault(page, vault);
  await page.goto("/library");
  await chooseKind(page, "TV Shows");
  await page.locator('[data-action="toggle-show"][data-show-id="4"]').click();
  await expect(page.getByText("Season 1")).toBeVisible();
  await page.locator('[data-action="toggle-show-season"][data-season-number="1"]').click();
  await expect(page.getByText("Pilot")).toBeVisible();
});

test("keeps library search in the address bar", async ({ page }) => {
  const vault: Vault = { user: null, ids: [], lists: [] };
  await installVault(page, vault);
  await page.goto("/library");
  await page.locator("[data-library-search]").fill("Orphan");
  await expect(page).toHaveURL(/\/library\?q=Orphan/);
  await expect(page.locator("[data-library-search]")).toHaveValue("Orphan");
});
