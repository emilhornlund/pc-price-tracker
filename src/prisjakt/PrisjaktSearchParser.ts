import * as cheerio from "cheerio";

import type { PrisjaktProductSummary } from "./types.js";

const PRISJAKT_BASE_URL = "https://www.prisjakt.nu";

function parsePriceSek(text: string): number | undefined {
  const match = text.trim().match(/^([\d\s\u00a0]+)\s*kr$/);

  if (!match?.[1]) {
    return undefined;
  }

  const normalized = match[1].replace(/[\s\u00a0]/g, "");
  const price = Number.parseInt(normalized, 10);

  return Number.isNaN(price) ? undefined : price;
}

export function parsePrisjaktSearch(html: string): PrisjaktProductSummary[] {
  const $ = cheerio.load(html);

  const products: PrisjaktProductSummary[] = [];

  $('ul[data-test="ProductGrid"] > li[data-test="ProductGridCard"]').each(
    (_, element) => {
      const card = $(element);

      const link = card.find('a[data-test="InternalLink"]').first();
      const href = link.attr("href");

      if (!href) {
        return;
      }

      const productUrl = new URL(href, PRISJAKT_BASE_URL);
      const id = productUrl.searchParams.get("p");

      if (!id) {
        return;
      }

      const name = card.find('[data-test="ProductName"]').first().text().trim();

      if (!name) {
        return;
      }

      const priceSek = card
        .find("span")
        .toArray()
        .map((element) => parsePriceSek($(element).text()))
        .find((price) => price !== undefined);

      if (priceSek === undefined) {
        return;
      }

      products.push({
        id,
        name,
        priceSek,
        url: productUrl.toString(),
      });
    },
  );

  return products;
}
