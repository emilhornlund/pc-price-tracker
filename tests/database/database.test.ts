import { describe, expect, it } from "vitest";

import { openDatabase } from "../../src/database/database.js";

describe("openDatabase", () => {
  it("initializes the product and offer tables", () => {
    const database = openDatabase(":memory:");

    try {
      const tables = database
        .prepare(
          `
          SELECT name
          FROM sqlite_schema
          WHERE type = 'table'
            AND name IN (
              'products',
              'product_details',
              'stores',
              'product_offers',
              'price_observations'
            )
          ORDER BY name
        `,
        )
        .all();

      expect(tables).toEqual([
        { name: "price_observations" },
        { name: "product_details" },
        { name: "product_offers" },
        { name: "products" },
        { name: "stores" },
      ]);
    } finally {
      database.close();
    }
  });

  it("initializes the expected product columns", () => {
    const database = openDatabase(":memory:");

    try {
      const columns = database
        .prepare("PRAGMA table_info(products)")
        .all()
        .map((column) => column.name);

      expect(columns).toEqual([
        "id",
        "prisjakt_id",
        "category",
        "name",
        "url",
        "first_seen_at",
        "last_seen_at",
      ]);
    } finally {
      database.close();
    }
  });

  it("initializes the expected product detail columns", () => {
    const database = openDatabase(":memory:");

    try {
      const columns = database
        .prepare("PRAGMA table_info(product_details)")
        .all()
        .map((column) => column.name);

      expect(columns).toEqual([
        "product_id",
        "brand",
        "description",
        "image_url",
      ]);
    } finally {
      database.close();
    }
  });

  it("initializes the expected offer columns", () => {
    const database = openDatabase(":memory:");

    try {
      expect(
        database
          .prepare("PRAGMA table_info(stores)")
          .all()
          .map((column) => column.name),
      ).toEqual([
        "id",
        "prisjakt_shop_id",
        "name",
        "first_seen_at",
        "last_seen_at",
      ]);

      expect(
        database
          .prepare("PRAGMA table_info(product_offers)")
          .all()
          .map((column) => column.name),
      ).toEqual([
        "id",
        "product_id",
        "store_id",
        "shop_offer_id",
        "first_seen_at",
        "last_seen_at",
      ]);

      expect(
        database
          .prepare("PRAGMA table_info(price_observations)")
          .all()
          .map((column) => column.name),
      ).toEqual(["id", "product_offer_id", "observed_at", "price_sek"]);
    } finally {
      database.close();
    }
  });
});
