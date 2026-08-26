import { describe, expect, it } from "vitest";

import { readFile } from "node:fs/promises";

import { parsePrisjaktProduct } from "../../src/prisjakt/PrisjaktProductParser.js";

function productStructuredDataHtml(data: Record<string, unknown>): string {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function offerRowsHtml(rows: unknown[]): string {
  const payload = `59:[["$","$L8b","",{"offerRows":${JSON.stringify(rows)}}]]`;

  return `<script>self.__next_f.push([1,${JSON.stringify(payload)}])</script>`;
}

function validOfferRow(): Record<string, unknown> {
  return {
    shopId: 5332,
    shopOfferId: "33249",
    price: { amount: 9290, currency: "SEK" },
    shop: { name: "Multitech Data" },
  };
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
      offers: [
        {
          shopId: 5332,
          shopName: "Multitech Data",
          shopOfferId: "33249",
          priceSek: 9290,
        },
        {
          shopId: 38513,
          shopName: "Amazon.se",
          shopOfferId: "B0DSQVNBD5",
          priceSek: 10029,
        },
        {
          shopId: 429,
          shopName: "CDON",
          shopOfferId: "11c08fcf-8079-559e-9657-38161843f459",
          priceSek: 11287,
        },
        {
          shopId: 1693,
          shopName: "MJ Multimedia",
          shopOfferId: "11521237A",
          priceSek: 11959,
        },
        {
          shopId: 429,
          shopName: "CDON",
          shopOfferId: "b1b7206b-8ca9-5b2e-bfec-3bea610c407b",
          priceSek: 12089,
        },
        {
          shopId: 429,
          shopName: "CDON",
          shopOfferId: "3ee581fe-4655-5b36-b4c8-018848f32ad7",
          priceSek: 13138,
        },
      ],
    });
  });

  it("returns no offers when the page has no offer rows", () => {
    expect(
      parsePrisjaktProduct(
        productStructuredDataHtml(validProductStructuredData()),
      ),
    ).toMatchObject({ offers: [] });
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

  it("rejects offer rows without a store identity", () => {
    const row = validOfferRow();
    delete row.shopId;

    expect(() =>
      parsePrisjaktProduct(
        `${productStructuredDataHtml(validProductStructuredData())}${offerRowsHtml([row])}`,
      ),
    ).toThrow("Prisjakt product offer at index 0 is invalid");
  });

  it("rejects offer rows with a non-SEK price", () => {
    const row = validOfferRow();
    row.price = { amount: 9290, currency: "EUR" };

    expect(() =>
      parsePrisjaktProduct(
        `${productStructuredDataHtml(validProductStructuredData())}${offerRowsHtml([row])}`,
      ),
    ).toThrow("Prisjakt product offer at index 0 is invalid");
  });
});
