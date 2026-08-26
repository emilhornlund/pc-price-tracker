import { describe, expect, it } from "vitest";

import { readFile } from "node:fs/promises";

import { parsePrisjaktProduct } from "../../src/prisjakt/PrisjaktProductParser.js";

function productStructuredDataHtml(data: Record<string, unknown>): string {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

describe("parsePrisjaktProduct", () => {
  it("parses product details from the captured Prisjakt fixture", async () => {
    const html = await readFile(
      "tests/fixtures/prisjakt/product-14547423.html",
      "utf8",
    );

    expect(parsePrisjaktProduct(html)).toEqual({
      brand: "Crucial",
      description:
        "Hitta Crucial Pro OC DDR5 6000MHz 2x32GB (CP2K32G60C40U5B) från Crucial i kategorin RAM-minne. Jämför priser från 4 butiker, med priser från 9\u00a0290 kr.",
      imageUrl: "https://cdn.pji.nu/product/standard/800/14547423.jpg",
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
    const productData: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      brand: { "@type": "Brand", name: "Crucial" },
      description: "Product description",
      image: "https://example.com/product.jpg",
    };

    delete productData[field];

    expect(() =>
      parsePrisjaktProduct(productStructuredDataHtml(productData)),
    ).toThrow(message);
  });
});
