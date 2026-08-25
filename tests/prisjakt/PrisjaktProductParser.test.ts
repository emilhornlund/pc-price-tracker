import { describe, expect, it } from "vitest";

import { parsePrisjaktProduct } from "../../src/prisjakt/PrisjaktProductParser.js";

describe("parsePrisjaktProduct", () => {
  it("parses product details from Prisjakt structured data", () => {
    const html = `
      <html>
        <body>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "Crucial Pro OC DDR5 6000MHz 2x32GB",
              "description": "Hitta Crucial Pro OC DDR5 6000MHz 2x32GB från Crucial i kategorin RAM-minne.",
              "image": "https://cdn.pji.nu/product/standard/800/14547423.jpg",
              "brand": {
                "@type": "Brand",
                "name": "Crucial"
              }
            }
          </script>

          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "item": {
                    "name": "Datorer & Tillbehör"
                  }
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "item": {
                    "name": "Datorkomponenter"
                  }
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "item": {
                    "name": "RAM-minne"
                  }
                }
              ]
            }
          </script>
        </body>
      </html>
    `;

    expect(parsePrisjaktProduct(html)).toEqual({
      brand: "Crucial",
      description:
        "Hitta Crucial Pro OC DDR5 6000MHz 2x32GB från Crucial i kategorin RAM-minne.",
      imageUrl: "https://cdn.pji.nu/product/standard/800/14547423.jpg",
    });
  });

  it("rejects pages without product structured data", () => {
    expect(() => parsePrisjaktProduct("<html></html>")).toThrow(
      "Prisjakt product structured data not found",
    );
  });
});
