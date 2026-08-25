import { describe, expect, it } from "vitest";

import { parsePrisjaktSearch } from "../../src/prisjakt/PrisjaktSearchParser.js";

describe("parsePrisjaktSearch", () => {
  it("extracts Prisjakt products from product links", () => {
    const html = `
      <html>
        <body>
          <a href="/produkt.php?p=14547423">
            Crucial Pro OC DDR5 6000MHz 2x32GB 9 039 kr
          </a>

          <a href="/produkt.php?p=13817544">
            G.Skill Trident Z5 Neo RGB DDR5 6000MHz 2x32GB 9 999 kr
          </a>
        </body>
      </html>
    `;

    expect(parsePrisjaktSearch(html)).toEqual([
      {
        id: "14547423",
        description: "Crucial Pro OC DDR5 6000MHz 2x32GB 9 039 kr",
        url: "https://www.prisjakt.nu/produkt.php?p=14547423",
      },
      {
        id: "13817544",
        description: "G.Skill Trident Z5 Neo RGB DDR5 6000MHz 2x32GB 9 999 kr",
        url: "https://www.prisjakt.nu/produkt.php?p=13817544",
      },
    ]);
  });

  it("ignores unrelated links", () => {
    const html = `
      <html>
        <body>
          <a href="/c/ram-minne">RAM-minnen</a>
          <a href="https://example.com">External link</a>
          <a href="/produkt.php?p=14547423">Valid product</a>
        </body>
      </html>
    `;

    expect(parsePrisjaktSearch(html)).toEqual([
      {
        id: "14547423",
        description: "Valid product",
        url: "https://www.prisjakt.nu/produkt.php?p=14547423",
      },
    ]);
  });

  it("ignores product links without a product id", () => {
    const html = `
      <html>
        <body>
          <a href="/produkt.php">Missing id</a>
          <a href="/produkt.php?foo=bar">Missing id</a>
        </body>
      </html>
    `;

    expect(parsePrisjaktSearch(html)).toEqual([]);
  });

  it("ignores product links without text", () => {
    const html = `
      <html>
        <body>
          <a href="/produkt.php?p=14547423"></a>
          <a href="/produkt.php?p=13817544">   </a>
        </body>
      </html>
    `;

    expect(parsePrisjaktSearch(html)).toEqual([]);
  });

  it("normalizes whitespace in the description", () => {
    const html = `
      <html>
        <body>
          <a href="/produkt.php?p=14547423">
            Crucial Pro OC
            DDR5 6000MHz

            2x32GB
          </a>
        </body>
      </html>
    `;

    expect(parsePrisjaktSearch(html)).toEqual([
      {
        id: "14547423",
        description: "Crucial Pro OC DDR5 6000MHz 2x32GB",
        url: "https://www.prisjakt.nu/produkt.php?p=14547423",
      },
    ]);
  });

  it("deduplicates products by Prisjakt product id", () => {
    const html = `
      <html>
        <body>
          <a href="/produkt.php?p=14547423">First occurrence</a>
          <a href="/produkt.php?p=14547423">Second occurrence</a>
        </body>
      </html>
    `;

    expect(parsePrisjaktSearch(html)).toEqual([
      {
        id: "14547423",
        description: "Second occurrence",
        url: "https://www.prisjakt.nu/produkt.php?p=14547423",
      },
    ]);
  });
});
