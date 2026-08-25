import * as cheerio from "cheerio";

import type { PrisjaktProductSummary } from "./types.js";

const PRISJAKT_BASE_URL = "https://www.prisjakt.nu";

export function parsePrisjaktSearch(html: string): PrisjaktProductSummary[] {
  const $ = cheerio.load(html);

  const products = $("a")
    .map((_, element) => {
      const link = $(element);
      const href = link.attr("href");

      if (!href?.includes("/produkt.php?p=")) {
        return undefined;
      }

      const productUrl = new URL(href, PRISJAKT_BASE_URL);
      const id = productUrl.searchParams.get("p");

      if (!id) {
        return undefined;
      }

      const text = link.text().trim().replace(/\s+/g, " ");

      if (!text) {
        return undefined;
      }

      return {
        id,
        description: text,
        url: productUrl.toString(),
      } satisfies PrisjaktProductSummary;
    })
    .get()
    .filter(
      (product): product is PrisjaktProductSummary => product !== undefined,
    );

  return [
    ...new Map(products.map((product) => [product.id, product])).values(),
  ];
}
