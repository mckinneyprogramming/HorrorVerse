import { isMediaKind, type MediaKind } from "./catalog";
import { isLibraryTagId } from "./tags";

export const HISTORY_VIEWS = ["home", "library", "upcoming", "lists", "account", "profile", "install", "stats"] as const;

export type HistoryView = (typeof HISTORY_VIEWS)[number];

export interface AppPlace {
  view: HistoryView;
  filter: MediaKind | "all";
  query: string;
  tag: string;
  franchisesOpen: boolean;
  profileId: number | null;
}

const VIEW_SET = new Set<string>(HISTORY_VIEWS);

export function emptyPlace(): AppPlace {
  return {
    view: "home",
    filter: "all",
    query: "",
    tag: "",
    franchisesOpen: false,
    profileId: null,
  };
}

export function parsePlace(pathname: string, search = ""): AppPlace {
  const path = pathname.replace(/\/+$/, "") || "/";
  const profile = /^\/profile\/(\d+)$/.exec(path);
  if (profile) {
    return { ...emptyPlace(), view: "profile", profileId: Number(profile[1]) };
  }

  const view = path === "/" ? "home" : path.slice(1);
  if (!VIEW_SET.has(view) || view === "profile") {
    return emptyPlace();
  }

  const params = new URLSearchParams(search);
  const kind = params.get("kind") ?? "";
  const tag = params.get("tag") ?? "";
  return {
    view: view as HistoryView,
    filter: isMediaKind(kind) ? kind : "all",
    query: (params.get("q") ?? "").trim().slice(0, 120),
    tag: isLibraryTagId(tag) ? tag : "",
    franchisesOpen: view === "library" && params.get("franchises") === "1",
    profileId: null,
  };
}

export function formatPlace(place: AppPlace): string {
  if (place.view === "home") {
    return "/";
  }

  if (place.view === "profile") {
    return place.profileId ? `/profile/${place.profileId}` : "/account";
  }

  if (place.view !== "library") {
    return `/${place.view}`;
  }

  const params = new URLSearchParams();
  if (place.filter !== "all") {
    params.set("kind", place.filter);
  }

  const query = place.query.trim();
  if (query) {
    params.set("q", query.slice(0, 120));
  }

  if (place.tag) {
    params.set("tag", place.tag);
  }

  if (place.franchisesOpen) {
    params.set("franchises", "1");
  }

  const search = params.toString();
  return search ? `/library?${search}` : "/library";
}
