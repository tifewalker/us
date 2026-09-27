// Chapter thresholds — the beach grows with the couple. Tune here only.
// A chapter unlocks when EITHER count reaches its threshold.
// "Completed" activity = both partners answered that day's prompt.

export type ChapterNumber = 1 | 2 | 3 | 4;

export type BeachItem =
  | "sea"
  | "sand"
  | "palm"
  | "sign"
  | "polaroid"
  | "palm2"
  | "starfish"
  | "colorfulShells"
  | "campfire"
  | "stringLights"
  | "hut";

export const CHAPTERS: {
  number: ChapterNumber;
  name: string;
  memories: number; // unlock at this many memories…
  activities: number; // …or this many completed daily activities
  items: BeachItem[]; // items this chapter adds
}[] = [
  { number: 1, name: "Where it started", memories: 0, activities: 0, items: ["sea", "sand", "palm", "sign", "polaroid"] },
  { number: 2, name: "Getting closer", memories: 5, activities: 7, items: ["palm2", "starfish", "colorfulShells"] },
  { number: 3, name: "Our adventures", memories: 15, activities: 20, items: ["campfire", "stringLights"] },
  { number: 4, name: "Still us", memories: 40, activities: 50, items: ["hut"] },
];

export function chapterFor(memories: number, completedActivities: number): ChapterNumber {
  let chapter: ChapterNumber = 1;
  for (const c of CHAPTERS) {
    if (memories >= c.memories || completedActivities >= c.activities) chapter = c.number;
  }
  return chapter;
}

// Every item unlocked up to and including `chapter`.
export function unlockedItems(chapter: ChapterNumber): BeachItem[] {
  return CHAPTERS.filter((c) => c.number <= chapter).flatMap((c) => c.items);
}

export function chapterInfo(chapter: ChapterNumber) {
  return CHAPTERS.find((c) => c.number === chapter)!;
}
