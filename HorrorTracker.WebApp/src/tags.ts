export const LIBRARY_TAGS = [
  { id: "slasher", label: "Slashers", pattern: /slasher/i },
  { id: "paranormal", label: "Paranormal", pattern: /paranormal|ghost|haunted|possession|poltergeist/i },
  { id: "zombie", label: "Zombies", pattern: /zombie/i },
  { id: "vampire", label: "Vampires", pattern: /vampire/i },
  { id: "werewolf", label: "Werewolves", pattern: /werewolf|lycan/i },
  { id: "witch", label: "Witches", pattern: /witch|coven|\boccult\b/i },
  { id: "demon", label: "Demons", pattern: /\bdemon|satanic|devil\b/i },
  { id: "sci-fi", label: "Science fiction", pattern: /science fiction|sci-fi|sci fi|time travel|space marine|extraterrestrial|\balien\b|android/i },
  { id: "comedy", label: "Comedy", pattern: /horror comedy|comedy horror|horror parody|horror spoof|\bparody\b|\bspoof\b|(?<!dark )\bcomedy\b/i },
  { id: "found-footage", label: "Found footage", pattern: /found footage/i },
  { id: "psychological", label: "Psychological", pattern: /psychological/i },
  { id: "body-horror", label: "Body horror", pattern: /body horror/i },
  { id: "folk-horror", label: "Folk horror", pattern: /folk horror/i },
  { id: "creature", label: "Creatures", pattern: /creature|monster|kaiju/i },
  { id: "cannibal", label: "Cannibals", pattern: /cannibal/i },
  { id: "serial-killer", label: "Serial killers", pattern: /serial killer/i },
  { id: "holiday", label: "Holiday", pattern: /holiday horror|christmas|thanksgiving|krampus/i },
  { id: "home-invasion", label: "Home invasion", pattern: /home invasion/i },
  { id: "anthology", label: "Anthology", pattern: /anthology/i },
] as const;

export type LibraryTagId = (typeof LIBRARY_TAGS)[number]["id"];

export function isLibraryTagId(value: string): value is LibraryTagId {
  return LIBRARY_TAGS.some((tag) => tag.id === value);
}

export function keywordsMatchTag(keywords: string[] | undefined, tagId: string): boolean {
  const tag = LIBRARY_TAGS.find((item) => item.id === tagId);
  if (!tag || !keywords?.length) {
    return false;
  }

  return keywords.some((keyword) => tag.pattern.test(keyword));
}

export function presentLibraryTags(entries: { keywords?: string[] }[]): (typeof LIBRARY_TAGS)[number][] {
  return LIBRARY_TAGS.filter((tag) => entries.some((entry) => keywordsMatchTag(entry.keywords, tag.id)));
}
