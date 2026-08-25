import { describe, expect, it } from "vitest";

import { readFile } from "node:fs/promises";

import { parsePrisjaktSearch } from "../../src/prisjakt/PrisjaktSearchParser.js";

describe("parsePrisjaktSearch", () => {
  it("extracts products from the main product grid", () => {
    const html = `
      <ul data-test="ProductGrid">
        <li data-test="ProductGridCard">
          <article data-test="ProductGridCard">
            <a data-test="InternalLink" href="/produkt.php?p=14547423">
              <span data-test="ProductName">
                Crucial Pro OC DDR5 6000MHz 2x32GB
              </span>
              <span>2 st, 40, DDR5</span>
              <span>9&nbsp;039&nbsp;kr</span>
            </a>
          </article>
        </li>

        <li data-test="ProductGridCard">
          <article data-test="ProductGridCard">
            <a data-test="InternalLink" href="/produkt.php?p=13817544">
              <span data-test="ProductName">
                G.Skill Trident Z5 Neo RGB DDR5 6000MHz 2x32GB
              </span>
              <span>9&nbsp;999&nbsp;kr</span>
            </a>
          </article>
        </li>
      </ul>
    `;

    expect(parsePrisjaktSearch(html)).toEqual([
      {
        id: "14547423",
        name: "Crucial Pro OC DDR5 6000MHz 2x32GB",
        priceSek: 9039,
        url: "https://www.prisjakt.nu/produkt.php?p=14547423",
      },
      {
        id: "13817544",
        name: "G.Skill Trident Z5 Neo RGB DDR5 6000MHz 2x32GB",
        priceSek: 9999,
        url: "https://www.prisjakt.nu/produkt.php?p=13817544",
      },
    ]);
  });

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

    expect(products[0]).toEqual({
      id: "14547423",
      name: "Crucial Pro OC DDR5 6000MHz 2x32GB (CP2K32G60C40U5B)",
      priceSek: 9039,
      url: "https://www.prisjakt.nu/produkt.php?p=14547423",
    });
  });
});
