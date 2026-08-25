import { describe, expect, it } from "vitest";

import { openDatabase } from "../../src/database/database.js";

describe("openDatabase", () => {
  it("initializes the products and product_details tables", () => {
    const database = openDatabase(":memory:");

    try {
      const tables = database
        .prepare(
          `
          SELECT name
          FROM sqlite_schema
          WHERE type = 'table'
            AND name IN ('products', 'product_details')
          ORDER BY name
        `,
        )
        .all();

      expect(tables).toEqual([
        { name: "product_details" },
        { name: "products" },
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
});
