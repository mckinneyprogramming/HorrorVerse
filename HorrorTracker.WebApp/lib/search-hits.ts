const SEARCH_RESULT_LIMIT = 8;

export interface SearchHit {
  sourceId: string;
  title: string;
  year?: number;
  overview?: string;
  coverUrl?: string;
}

export function describedHit(sourceId: string, title: string, year: number | undefined, overview: string, coverUrl: string | undefined): SearchHit {
  return {
    sourceId,
    title,
    ...(year ? { year } : {}),
    ...(overview ? { overview } : {}),
    ...(coverUrl ? { coverUrl } : {}),
  };
}

export function rankedHits<T extends SearchHit>(hits: { horror: boolean; index: number; hit: T }[]): T[] {
  return hits
    .sort((left, right) => Number(right.horror) - Number(left.horror) || left.index - right.index)
    .slice(0, SEARCH_RESULT_LIMIT)
    .map((item) => item.hit);
}
