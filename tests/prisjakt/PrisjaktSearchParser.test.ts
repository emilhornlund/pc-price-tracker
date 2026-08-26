import { describe, expect, it } from "vitest";

import { readFile } from "node:fs/promises";

import { parsePrisjaktSearch } from "../../src/prisjakt/PrisjaktSearchParser.js";

describe("parsePrisjaktSearch", () => {
  it("ignores product cards outside the main product grid", () => {
    const html = `
      <section>
        <article data-test="ProductGridCard">
          <a data-test="InternalLink" href="/produkt.php?p=999">
            <span data-test="ProductName">Trending product</span>
            <span>1 000 kr</span>
          </a>
        </article>
      </section>

      <ul data-test="ProductGrid">
        <li data-test="ProductGridCard">
          <a data-test="InternalLink" href="/produkt.php?p=123">
            <span data-test="ProductName">Search result</span>
            <span>2 000 kr</span>
          </a>
        </li>
      </ul>
    `;

    expect(parsePrisjaktSearch(html)).toEqual([
      {
        id: "123",
        name: "Search result",
        priceSek: 2000,
        url: "https://www.prisjakt.nu/produkt.php?p=123",
      },
    ]);
  });

  it("ignores cards without a product id", () => {
    const html = `
      <ul data-test="ProductGrid">
        <li data-test="ProductGridCard">
          <a data-test="InternalLink" href="/produkt.php">
            <span data-test="ProductName">Missing ID</span>
            <span>1 000 kr</span>
          </a>
        </li>
      </ul>
    `;

    expect(parsePrisjaktSearch(html)).toEqual([]);
  });

  it("ignores cards without a product name", () => {
    const html = `
      <ul data-test="ProductGrid">
        <li data-test="ProductGridCard">
          <a data-test="InternalLink" href="/produkt.php?p=123">
            <span>1 000 kr</span>
          </a>
        </li>
      </ul>
    `;

    expect(parsePrisjaktSearch(html)).toEqual([]);
  });

  it("ignores cards without a price", () => {
    const html = `
      <ul data-test="ProductGrid">
        <li data-test="ProductGridCard">
          <a data-test="InternalLink" href="/produkt.php?p=123">
            <span data-test="ProductName">Product</span>
          </a>
        </li>
      </ul>
    `;

    expect(parsePrisjaktSearch(html)).toEqual([]);
  });

  it("parses prices containing normal and non-breaking spaces", () => {
    const html = `
      <ul data-test="ProductGrid">
        <li data-test="ProductGridCard">
          <a data-test="InternalLink" href="/produkt.php?p=1">
            <span data-test="ProductName">Product One</span>
            <span>12 345 kr</span>
          </a>
        </li>

        <li data-test="ProductGridCard">
          <a data-test="InternalLink" href="/produkt.php?p=2">
            <span data-test="ProductName">Product Two</span>
            <span>13&nbsp;821&nbsp;kr</span>
          </a>
        </li>
      </ul>
    `;

    expect(
      parsePrisjaktSearch(html).map((product) => product.priceSek),
    ).toEqual([12345, 13821]);
  });

  it("parses the captured Prisjakt RAM search fixture", async () => {
    const html = await readFile(
      "tests/fixtures/prisjakt/ram-search.html",
      "utf8",
    );

    const products = parsePrisjaktSearch(html);

    expect(products).toHaveLength(29);
    expect(products.map((product) => product.id)).toEqual([
      "14547423",
      "13817544",
      "14547416",
      "13954141",
      "14103662",
      "15514369",
      "14811090",
      "11995747",
      "12917181",
      "15514375",
      "11655318",
      "15355789",
      "14103673",
      "11661376",
      "14103672",
      "14103665",
      "14103671",
      "14103658",
      "11661904",
      "14840424",
      "14104155",
      "11226586",
      "11534845",
      "14299020",
      "10312076",
      "16393482",
      "13438177",
      "11995707",
      "11656326",
    ]);

    expect(products[0]).toEqual({
      id: "14547423",
      name: "Crucial Pro OC DDR5 6000MHz 2x32GB (CP2K32G60C40U5B)",
      priceSek: 9039,
      url: "https://www.prisjakt.nu/produkt.php?p=14547423",
    });

    expect(products[1]).toEqual({
      id: "13817544",
      name: "G.Skill Trident Z5 Neo RGB DDR5 6000MHz 2x32GB (F5-6000J3040G32GX2-TZ5NR)",
      priceSek: 9999,
      url: "https://www.prisjakt.nu/produkt.php?p=13817544",
    });

    expect(products[14]).toEqual({
      id: "14103672",
      name: "G.Skill Flare X5 White DDR5 6000MHz 2x32GB (F5-6000J3636F32GX2-FX5W)",
      priceSek: 12478,
      url: "https://www.prisjakt.nu/produkt.php?p=14103672",
    });

    expect(products[28]).toEqual({
      id: "11656326",
      name: "Corsair Vengeance Black DDR5 6000MHz 2x32GB (CMK64GX5M2B6000Z30)",
      priceSek: 14999,
      url: "https://www.prisjakt.nu/produkt.php?p=11656326",
    });
  });
});
