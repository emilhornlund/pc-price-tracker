import { parsePrisjaktSearch } from "./PrisjaktSearchParser.js";
import type { PrisjaktProductSummary } from "./types.js";

export async function searchPrisjakt(
  url: string,
): Promise<PrisjaktProductSummary[]> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; pc-price-tracker/0.1)",
      "accept-language": "sv-SE,sv;q=0.9,en;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Prisjakt request failed: ${response.status} ${response.statusText}`,
    );
  }

  const html = await response.text();

  return parsePrisjaktSearch(html);
}
