import * as cheerio from "cheerio";

import type { PrisjaktProductDetails } from "./types.js";

interface ProductStructuredData {
  "@type"?: unknown;
  description?: unknown;
  image?: unknown;
  brand?: {
    name?: unknown;
  };
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

  return {
    brand: brand.trim(),
    description: description.trim(),
    imageUrl: image.trim(),
  };
}
