/**
 * Bubble API client for migration scripts.
 * Handles pagination automatically — fetches all records for any type.
 */

const BUBBLE_API_BASE = "https://artswrk.com/api/1.1/obj";
const BUBBLE_API_TOKEN = process.env.BUBBLE_API_TOKEN;

if (!BUBBLE_API_TOKEN) {
  throw new Error("BUBBLE_API_TOKEN environment variable is required");
}

export async function fetchAllRecords<T>(
  type: string,
  onProgress?: (fetched: number, total: number) => void
): Promise<T[]> {
  const results: T[] = [];
  let cursor = 0;
  const limit = 100;
  let total = 0;

  while (true) {
    const url = `${BUBBLE_API_BASE}/${type}?limit=${limit}&cursor=${cursor}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${BUBBLE_API_TOKEN}` },
    });

    if (!res.ok) {
      throw new Error(`Bubble API error for type "${type}": ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const { results: batch, remaining, count } = data.response;

    results.push(...batch);
    total = results.length + remaining;

    onProgress?.(results.length, total);

    if (remaining === 0) break;
    cursor += limit;
  }

  return results;
}
