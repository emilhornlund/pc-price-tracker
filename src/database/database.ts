import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const database = new DatabaseSync(path);

  try {
    database.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        prisjakt_id TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS product_details (
        product_id INTEGER PRIMARY KEY,
        brand TEXT NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY,
        prisjakt_shop_id INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS product_offers (
        id INTEGER PRIMARY KEY,
        product_id INTEGER NOT NULL,
        store_id INTEGER NOT NULL,
        shop_offer_id TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        UNIQUE (product_id, store_id, shop_offer_id),
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
      ) STRICT;

      CREATE TABLE IF NOT EXISTS price_observations (
        id INTEGER PRIMARY KEY,
        product_offer_id INTEGER NOT NULL,
        observed_at TEXT NOT NULL,
        price_sek INTEGER NOT NULL CHECK (price_sek >= 0),
        UNIQUE (product_offer_id, observed_at),
        FOREIGN KEY (product_offer_id) REFERENCES product_offers(id) ON DELETE CASCADE
      ) STRICT;
    `);

    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
