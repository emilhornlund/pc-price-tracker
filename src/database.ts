import { mkdirSync } from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

export const DEFAULT_DATABASE_PATH =
  '/opt/pc-price-tracker/data/pc-price-tracker.db';

export type TrackerDatabase = Database.Database;

export function openDatabase(
  databasePath = DEFAULT_DATABASE_PATH,
): TrackerDatabase {
  ensureDatabaseDirectory(databasePath);

  const database = new Database(databasePath);

  try {
    initializeDatabase(database);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

export function initializeDatabase(database: TrackerDatabase): void {
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      store_id TEXT NOT NULL,
      price INTEGER NOT NULL,
      observed_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (store_id) REFERENCES stores (id)
    );

    CREATE INDEX IF NOT EXISTS price_observations_product_store_time
      ON price_observations (product_id, store_id, observed_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sent_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      store_id TEXT NOT NULL,
      previous_price INTEGER NOT NULL,
      new_price INTEGER NOT NULL,
      decrease INTEGER NOT NULL,
      FOREIGN KEY (notification_id) REFERENCES notifications (id),
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (store_id) REFERENCES stores (id)
    );
  `);
}

export function closeDatabase(database: TrackerDatabase): void {
  if (database.open) {
    database.close();
  }
}

function ensureDatabaseDirectory(databasePath: string): void {
  if (databasePath === ':memory:' || databasePath.startsWith('file:')) {
    return;
  }

  mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
}
