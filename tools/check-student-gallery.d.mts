// Types for check-student-gallery.mjs, so the portal's TypeScript tests can import it.
export function roundHalfEven(x: number): number;
export function competitionRanks(scores: number[]): number[];
export function checkGallery(input: { gallery: string; index?: string | null; readme?: string | null }): {
  problems: string[];
  summary: string;
};
