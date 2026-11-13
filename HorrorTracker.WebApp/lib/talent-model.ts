export interface TalentName {
  id: number;
  name: string;
  role: string;
  profilePath?: string;
}

export interface TalentCredit {
  tmdbId: number;
  mediaType: "movie" | "tv";
  kind: "movie" | "documentary" | "show";
  title: string;
  year?: number;
  posterPath?: string;
  role: string;
  vaultId?: string;
  finished: boolean;
}

export interface TalentPerson {
  id: number;
  name: string;
  profilePath?: string;
  knownFor?: string;
  following: boolean;
  watched: number;
  total: number;
  credits: TalentCredit[];
}

export interface TalentFollow {
  id: number;
  name: string;
  profilePath?: string;
  knownFor?: string;
  watched: number;
  total: number;
}
