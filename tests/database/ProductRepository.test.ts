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
          category: "memory",
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
            category,
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
        category: "memory",
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
          category: "memory",
          name: "Original name",
          url: "https://www.prisjakt.nu/produkt.php?p=14547423",
        },
        "2026-08-25T10:00:00.000Z",
      );

      repository.upsert(
        {
          prisjaktId: "14547423",
          category: "memory",
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
            category,
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
        category: "memory",
        name: "Updated name",
        url: "https://www.prisjakt.nu/produkt.php?p=14547423&updated=true",
        first_seen_at: "2026-08-25T10:00:00.000Z",
        last_seen_at: "2026-08-26T10:00:00.000Z",
      });
    } finally {
      database.close();
    }
  });

  it("returns the first persisted product", () => {
    const database = openDatabase(":memory:");

    try {
      const repository = new ProductRepository(database);

      repository.upsert(
        {
          prisjaktId: "14547423",
          category: "memory",
          name: "Crucial Pro OC DDR5 6000MHz 2x32GB",
          url: "https://www.prisjakt.nu/produkt.php?p=14547423",
        },
        "2026-08-25T10:00:00.000Z",
      );

      const product = repository.findFirst();

      expect(product).toEqual({
        id: 1,
        prisjaktId: "14547423",
        category: "memory",
        name: "Crucial Pro OC DDR5 6000MHz 2x32GB",
        url: "https://www.prisjakt.nu/produkt.php?p=14547423",
      });
    } finally {
      database.close();
    }
  });

  it("persists product details for a product", () => {
    const database = openDatabase(":memory:");

    try {
      const repository = new ProductRepository(database);

      repository.upsert(
        {
          prisjaktId: "14547423",
          category: "memory",
          name: "Crucial Pro OC DDR5 6000MHz 2x32GB",
          url: "https://www.prisjakt.nu/produkt.php?p=14547423",
        },
        "2026-08-25T10:00:00.000Z",
      );

      const product = repository.findFirst();

      expect(product).toBeDefined();

      repository.upsertDetails(product!.id, {
        brand: "Crucial",
        description: "Product description",
        imageUrl: "https://cdn.pji.nu/product/standard/800/14547423.jpg",
      });

      const details = database
        .prepare(
          `
          SELECT
            product_id,
            brand,
            description,
            image_url
          FROM product_details
        `,
        )
        .get();

      expect(details).toEqual({
        product_id: product!.id,
        brand: "Crucial",
        description: "Product description",
        image_url: "https://cdn.pji.nu/product/standard/800/14547423.jpg",
      });
    } finally {
      database.close();
    }
  });
});
