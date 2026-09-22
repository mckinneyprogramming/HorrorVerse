import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "./catalog";
import { buildHorrorStats } from "./stats";

const scream: CatalogEntry = {
  id: "movie:1",
  mediaId: 1,
  title: "Scream",
  kind: "movie",
  completed: false,
  totalTime: 111,
  releaseYear: 1996,
};

const aliens: CatalogEntry = {
  id: "movie:2",
  mediaId: 2,
  title: "Aliens",
  kind: "movie",
  completed: false,
  totalTime: 137,
  releaseYear: 1986,
  seriesId: 10,
};

const alienSeries: CatalogEntry = {
  id: "series:10",
  mediaId: 10,
  title: "Alien",
  kind: "series",
  completed: false,
};

function stat(group: { extras: { label: string; value: string }[]; time: { label: string; value: string }[] }, label: string) {
  return [...group.time, ...group.extras].find((item) => item.label === label);
}

describe("buildHorrorStats", () => {
  const entries = [scream, aliens, alienSeries];

  it("returns vault stats without a signed-in group", () => {
    const stats = buildHorrorStats(entries, [], false);

    expect(stats.yours).toBeUndefined();
    expect(stat(stats.vault, "Longest film")?.value).toBe("Aliens");
    expect(stat(stats.vault, "Oldest title")?.value).toBe("1986");
    expect(stat(stats.vault, "Biggest series")?.value).toBe("1");
    expect(stat(stats.vault, "Biggest series")?.hint).toContain("Alien");
  });

  it("counts only finished runtimes in the personal group", () => {
    const stats = buildHorrorStats(entries, ["movie:1"], true);

    expect(stats.yours).toBeDefined();
    expect(stat(stats.yours!, "Hours survived")?.value).toBe("1 hr 51 min");
    expect(stat(stats.yours!, "Your longest night")?.value).toBe("Scream");
    expect(stat(stats.yours!, "Oldest you've survived")?.value).toBe("1996");
  });

  it("handles an empty vault", () => {
    const stats = buildHorrorStats([], [], true);

    expect(stat(stats.vault, "In the vault")?.value).toBe("0 hr");
    expect(stat(stats.yours!, "Hours survived")?.value).toBe("0 hr");
    expect(stats.vault.extras).toEqual([]);
  });
});
