import * as cheerio from "cheerio";

import type { PrisjaktProductDetails, PrisjaktProductOffer } from "./types.js";

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

interface ProductOfferRow {
  shopId?: unknown;
  shopOfferId?: unknown;
  price?: unknown;
  shop?: unknown;
}

interface ProductOfferPrice {
  amount?: unknown;
  currency?: unknown;
}

interface ProductOfferShop {
  name?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function parsePriceSek(offers: unknown): number {
  const productOffers = asRecord(offers);

  if (!productOffers) {
    throw new Error("Prisjakt product offers not found");
  }

  const { lowPrice, priceCurrency } = productOffers as ProductOffers;

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

function decodeNextFlightPayload(script: string): string | undefined {
  const prefix = "self.__next_f.push(";
  const start = script.indexOf(prefix);

  if (start === -1) {
    return undefined;
  }

  const serializedPayload = script.slice(start + prefix.length).trim();

  if (!serializedPayload.endsWith(")")) {
    return undefined;
  }

  try {
    const payload: unknown = JSON.parse(serializedPayload.slice(0, -1));

    if (
      !Array.isArray(payload) ||
      payload.length < 2 ||
      typeof payload[1] !== "string"
    ) {
      return undefined;
    }

    return payload[1];
  } catch {
    return undefined;
  }
}

function extractOfferRows(payload: string): unknown[] | undefined {
  const keyMatch = /"offerRows"\s*:/.exec(payload);

  if (!keyMatch || keyMatch.index === undefined) {
    return undefined;
  }

  let arrayStart = keyMatch.index + keyMatch[0].length;

  while (/\s/.test(payload[arrayStart] ?? "")) {
    arrayStart += 1;
  }

  if (payload[arrayStart] !== "[") {
    throw new Error("Prisjakt product offer rows are invalid");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = arrayStart; index < payload.length; index += 1) {
    const character = payload[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "[") {
      depth += 1;
    } else if (character === "]") {
      depth -= 1;

      if (depth === 0) {
        try {
          const rows: unknown = JSON.parse(
            payload.slice(arrayStart, index + 1),
          );

          if (!Array.isArray(rows)) {
            throw new Error("Prisjakt product offer rows are invalid");
          }

          return rows;
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "Prisjakt product offer rows are invalid"
          ) {
            throw error;
          }

          throw new Error("Prisjakt product offer rows are invalid", {
            cause: error,
          });
        }
      }
    }
  }

  throw new Error("Prisjakt product offer rows are invalid");
}

function parseProductOffer(row: unknown, index: number): PrisjaktProductOffer {
  const offer = asRecord(row) as ProductOfferRow | undefined;
  const price = asRecord(offer?.price) as ProductOfferPrice | undefined;
  const shop = asRecord(offer?.shop) as ProductOfferShop | undefined;

  if (
    !offer ||
    typeof offer.shopId !== "number" ||
    !Number.isSafeInteger(offer.shopId) ||
    offer.shopId < 0 ||
    typeof offer.shopOfferId !== "string" ||
    !offer.shopOfferId.trim() ||
    !price ||
    price.currency !== "SEK" ||
    typeof price.amount !== "number" ||
    !Number.isSafeInteger(price.amount) ||
    price.amount < 0 ||
    !shop ||
    typeof shop.name !== "string" ||
    !shop.name.trim()
  ) {
    throw new Error(`Prisjakt product offer at index ${index} is invalid`);
  }

  return {
    shopId: offer.shopId,
    shopName: shop.name.trim(),
    shopOfferId: offer.shopOfferId.trim(),
    priceSek: price.amount,
  };
}

function parseProductOffers($: cheerio.CheerioAPI): PrisjaktProductOffer[] {
  let offers: PrisjaktProductOffer[] | undefined;

  $("script").each((_, element) => {
    if (offers !== undefined) {
      return;
    }

    const payload = decodeNextFlightPayload($(element).text());

    if (!payload) {
      return;
    }

    const rows = extractOfferRows(payload);

    if (rows === undefined) {
      return;
    }

    offers = rows.map((row, index) => parseProductOffer(row, index));
  });

  return offers ?? [];
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
  const offers = parseProductOffers($);

  return {
    brand: brand.trim(),
    description: description.trim(),
    imageUrl: image.trim(),
    priceSek,
    offers,
  };
}
