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
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      ) STRICT;
    `);

    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
