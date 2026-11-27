/**
 * The API returns at most one page per request, whatever limit is asked.
 * Reads page after page so a consumption total is not cut silently.
 */

const PAGE_SIZE = 1000;
export const MAX_ROWS = 5000;

export async function readAllPages<T>(
  readPage: (from: number, to: number) => Promise<T[]>,
): Promise<{ rows: T[]; capped: boolean }> {
  const rows: T[] = [];
  while (rows.length < MAX_ROWS) {
    const page = await readPage(rows.length, rows.length + PAGE_SIZE - 1);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, capped: false };
  }
  return { rows, capped: true };
}
