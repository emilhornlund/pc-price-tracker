import * as cheerio from "cheerio";

import type { PrisjaktProductDetails } from "./types.js";

interface ProductStructuredData {
  "@type"?: unknown;
  description?: unknown;
  image?: unknown;
  brand?: {
    name?: unknown;
  };
  offers?: unknown;
}

interface ProductOffers {
  lowPrice?: unknown;
  priceCurrency?: unknown;
}

function parsePriceSek(offers: unknown): number {
  if (typeof offers !== "object" || offers === null || Array.isArray(offers)) {
    throw new Error("Prisjakt product offers not found");
  }

  const { lowPrice, priceCurrency } = offers as ProductOffers;

  if (typeof priceCurrency !== "string" || !priceCurrency.trim()) {
    throw new Error("Prisjakt product price currency not found");
  }

  if (priceCurrency !== "SEK") {
    throw new Error("Prisjakt product price currency is not SEK");
  }

  if (
    typeof lowPrice !== "number" ||
    !Number.isInteger(lowPrice) ||
    lowPrice < 0
  ) {
    throw new Error("Prisjakt product low price is invalid");
  }

  return lowPrice;
}

export function parsePrisjaktProduct(html: string): PrisjaktProductDetails {
  const $ = cheerio.load(html);

  let productData: ProductStructuredData | undefined;

  $('script[type="application/ld+json"]').each((_, element) => {
    const text = $(element).text();

    if (!text) {
      return;
    }

    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      return;
    }

    if (
      typeof data === "object" &&
      data !== null &&
      "@type" in data &&
      (data as { "@type"?: unknown })["@type"] === "Product"
    ) {
      productData = data as ProductStructuredData;
    }
  });

  if (!productData) {
    throw new Error("Prisjakt product structured data not found");
  }

  const brand = productData.brand?.name;
  const description = productData.description;
  const image = productData.image;

  if (typeof brand !== "string" || !brand.trim()) {
    throw new Error("Prisjakt product brand not found");
  }

  if (typeof description !== "string" || !description.trim()) {
    throw new Error("Prisjakt product description not found");
  }

  if (typeof image !== "string" || !image.trim()) {
    throw new Error("Prisjakt product image not found");
  }

  // AggregateOffer.lowPrice is the currency-qualified lowest offer on the product page.
  const priceSek = parsePriceSek(productData.offers);

  return {
    brand: brand.trim(),
    description: description.trim(),
    imageUrl: image.trim(),
    priceSek,
  };
}
