export type DailyBrewCandidate = {
  id: string;
  hasApprovedImage: boolean;
};

/**
 * Deterministic (no AI, no randomness) daily-brew pick.
 *
 * Same `dateKey` + same candidate list always yields the same recipe, so the pick stays stable
 * for the whole calendar day and across app restarts/devices. Recipes with approved (non-placeholder)
 * imagery are preferred; if none exist yet, any eligible recipe is a valid fallback. To avoid
 * repeating the same drink day after day, the pick for `dateKey` is nudged away from the *raw*
 * hash bucket used the previous calendar day whenever more than one candidate is eligible. This
 * reduces immediate repeats but is not an absolute guarantee across arbitrary histories.
 */
export function selectDailyBrewRecipeId(
  candidates: readonly DailyBrewCandidate[],
  dateKey: string,
): string | null {
  if (!candidates.length) return null;

  const withApprovedImage = candidates.filter((candidate) => candidate.hasApprovedImage);
  const pool = withApprovedImage.length > 0 ? withApprovedImage : candidates;
  if (pool.length === 1) return pool[0]!.id;

  const todayIndex = hashToIndex(dateKey, pool.length);
  const previousDateKey = shiftDateKey(dateKey, -1);
  const previousIndex = hashToIndex(previousDateKey, pool.length);

  const finalIndex = todayIndex === previousIndex ? (todayIndex + 1) % pool.length : todayIndex;
  return pool[finalIndex]!.id;
}

function hashToIndex(key: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + deltaDays));
  return formatDateKey(date);
}

export function formatDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
