import { describe, expect, it } from "vitest";

import { readFile } from "node:fs/promises";

import { parsePrisjaktProduct } from "../../src/prisjakt/PrisjaktProductParser.js";

function productStructuredDataHtml(data: Record<string, unknown>): string {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function validProductStructuredData(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    brand: { "@type": "Brand", name: "Crucial" },
    description: "Product description",
    image: "https://example.com/product.jpg",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: 9290,
      priceCurrency: "SEK",
    },
  };
}

describe("parsePrisjaktProduct", () => {
  it("parses product details and current price from the captured fixture", async () => {
    const html = await readFile(
      "tests/fixtures/prisjakt/product-14547423.html",
      "utf8",
    );

    expect(parsePrisjaktProduct(html)).toEqual({
      brand: "Crucial",
      description:
        "Hitta Crucial Pro OC DDR5 6000MHz 2x32GB (CP2K32G60C40U5B) från Crucial i kategorin RAM-minne. Jämför priser från 4 butiker, med priser från 9\u00a0290 kr.",
      imageUrl: "https://cdn.pji.nu/product/standard/800/14547423.jpg",
      priceSek: 9290,
    });
  });

  it("rejects pages without product structured data", () => {
    expect(() => parsePrisjaktProduct("<html></html>")).toThrow(
      "Prisjakt product structured data not found",
    );
  });

  it.each([
    ["brand", "Prisjakt product brand not found"],
    ["description", "Prisjakt product description not found"],
    ["image", "Prisjakt product image not found"],
  ])("rejects product structured data without %s", (field, message) => {
    const productData = validProductStructuredData();

    delete productData[field];

    expect(() =>
      parsePrisjaktProduct(productStructuredDataHtml(productData)),
    ).toThrow(message);
  });

  it("rejects product structured data without offers", () => {
    const productData = validProductStructuredData();

    delete productData.offers;

    expect(() =>
      parsePrisjaktProduct(productStructuredDataHtml(productData)),
    ).toThrow("Prisjakt product offers not found");
  });

  it("rejects product structured data without a low price", () => {
    const productData = validProductStructuredData();
    const offers = productData.offers as Record<string, unknown>;

    delete offers.lowPrice;

    expect(() =>
      parsePrisjaktProduct(productStructuredDataHtml(productData)),
    ).toThrow("Prisjakt product low price is invalid");
  });

  it("rejects non-integer low prices", () => {
    const productData = validProductStructuredData();
    const offers = productData.offers as Record<string, unknown>;

    offers.lowPrice = 9290.5;

    expect(() =>
      parsePrisjaktProduct(productStructuredDataHtml(productData)),
    ).toThrow("Prisjakt product low price is invalid");
  });

  it.each([
    [undefined, "Prisjakt product price currency not found"],
    ["EUR", "Prisjakt product price currency is not SEK"],
  ])("rejects price currency %s", (priceCurrency, message) => {
    const productData = validProductStructuredData();
    const offers = productData.offers as Record<string, unknown>;

    offers.priceCurrency = priceCurrency;

    expect(() =>
      parsePrisjaktProduct(productStructuredDataHtml(productData)),
    ).toThrow(message);
  });
});
