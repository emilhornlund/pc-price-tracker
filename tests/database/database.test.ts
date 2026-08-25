import { describe, expect, it } from "vitest";

import { openDatabase } from "../../src/database/database.js";

describe("openDatabase", () => {
  it("initializes the products table", () => {
    const database = openDatabase(":memory:");

    try {
      const table = database
        .prepare(
          `
              SELECT name
              FROM sqlite_schema
              WHERE type = 'table'
                AND name = 'products'
          `,
        )
        .get();

      expect(table?.name).toBe("products");
    } finally {
      database.close();
    }
  });
});
