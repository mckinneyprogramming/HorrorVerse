export interface ShowEpisode {
  id: number;
  episodeNumber: number;
  title: string;
  runtime: number;
  year?: number;
  completed: boolean;
}

export interface ShowSeason {
  id: number;
  seasonNumber: number;
  title: string;
  episodeCount: number;
  finishedCount: number;
  loaded: boolean;
  episodes: ShowEpisode[];
}

export interface ShowGuide {
  id: string;
  showId: number;
  seasons: ShowSeason[];
}

export async function fetchShowGuide(showId: number, season?: number): Promise<ShowGuide> {
  const query = new URLSearchParams({ id: `show:${showId}` });
  if (season !== undefined) {
    query.set("season", String(season));
  }

  const response = await fetch(`/api/shows?${query.toString()}`);
  return readGuide(response);
}

export async function setEpisodeProgress(episodeId: number, completed: boolean): Promise<ShowGuide> {
  return writeGuide({ episodeId, completed });
}

export async function setSeasonProgress(seasonId: number, completed: boolean): Promise<ShowGuide> {
  return writeGuide({ seasonId, completed });
}

async function writeGuide(body: { episodeId?: number; seasonId?: number; completed: boolean }): Promise<ShowGuide> {
  const response = await fetch("/api/shows", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return readGuide(response);
}

async function readGuide(response: Response): Promise<ShowGuide> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Show request failed (${response.status})`);
  }

  return payload as ShowGuide;
}
