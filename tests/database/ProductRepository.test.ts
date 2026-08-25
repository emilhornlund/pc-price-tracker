import { describe, expect, it } from "vitest";

import { ProductRepository } from "../../src/database/ProductRepository.js";
import { openDatabase } from "../../src/database/database.js";

describe("ProductRepository", () => {
  it("inserts a product", () => {
    const database = openDatabase(":memory:");

    try {
      const repository = new ProductRepository(database);

      repository.upsert(
        {
          prisjaktId: "14547423",
          name: "Crucial Pro OC DDR5 6000MHz 2x32GB",
          url: "https://www.prisjakt.nu/produkt.php?p=14547423",
        },
        "2026-08-25T10:00:00.000Z",
      );

      const product = database
        .prepare(
          `
            SELECT
              prisjakt_id,
              name,
              url,
              first_seen_at,
              last_seen_at
            FROM products
          `,
        )
        .get();

      expect(product).toEqual({
        prisjakt_id: "14547423",
        name: "Crucial Pro OC DDR5 6000MHz 2x32GB",
        url: "https://www.prisjakt.nu/produkt.php?p=14547423",
        first_seen_at: "2026-08-25T10:00:00.000Z",
        last_seen_at: "2026-08-25T10:00:00.000Z",
      });
    } finally {
      database.close();
    }
  });

  it("updates a rediscovered product without duplicating it", () => {
    const database = openDatabase(":memory:");

    try {
      const repository = new ProductRepository(database);

      repository.upsert(
        {
          prisjaktId: "14547423",
          name: "Original name",
          url: "https://www.prisjakt.nu/produkt.php?p=14547423",
        },
        "2026-08-25T10:00:00.000Z",
      );

      repository.upsert(
        {
          prisjaktId: "14547423",
          name: "Updated name",
          url: "https://www.prisjakt.nu/produkt.php?p=14547423&updated=true",
        },
        "2026-08-26T10:00:00.000Z",
      );

      const count = database
        .prepare("SELECT COUNT(*) AS count FROM products")
        .get();

      expect(count?.count).toBe(1);

      const product = database
        .prepare(
          `
            SELECT
              prisjakt_id,
              name,
              url,
              first_seen_at,
              last_seen_at
            FROM products
          `,
        )
        .get();

      expect(product).toEqual({
        prisjakt_id: "14547423",
        name: "Updated name",
        url: "https://www.prisjakt.nu/produkt.php?p=14547423&updated=true",
        first_seen_at: "2026-08-25T10:00:00.000Z",
        last_seen_at: "2026-08-26T10:00:00.000Z",
      });
    } finally {
      database.close();
    }
  });
});
