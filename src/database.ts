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
      event_type TEXT NOT NULL DEFAULT 'PRICE_DECREASE',
      previous_price INTEGER,
      new_price INTEGER NOT NULL,
      decrease INTEGER,
      FOREIGN KEY (notification_id) REFERENCES notifications (id),
      FOREIGN KEY (product_id) REFERENCES products (id),
      FOREIGN KEY (store_id) REFERENCES stores (id)
    );
  `);

  migrateNotificationChanges(database);
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

interface NotificationChangesColumn {
  name: string;
  notnull: number;
}

function migrateNotificationChanges(database: TrackerDatabase): void {
  const columns = database
    .prepare('PRAGMA table_info(notification_changes)')
    .all() as NotificationChangesColumn[];
  const eventType = columns.find((column) => column.name === 'event_type');
  const previousPrice = columns.find(
    (column) => column.name === 'previous_price',
  );
  const decrease = columns.find((column) => column.name === 'decrease');

  if (
    eventType !== undefined &&
    previousPrice?.notnull === 0 &&
    decrease?.notnull === 0
  ) {
    return;
  }

  const migrate = database.transaction(() => {
    database.exec(
      'ALTER TABLE notification_changes RENAME TO notification_changes_legacy',
    );
    database.exec(`
      CREATE TABLE notification_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notification_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        store_id TEXT NOT NULL,
        event_type TEXT NOT NULL DEFAULT 'PRICE_DECREASE',
        previous_price INTEGER,
        new_price INTEGER NOT NULL,
        decrease INTEGER,
        FOREIGN KEY (notification_id) REFERENCES notifications (id),
        FOREIGN KEY (product_id) REFERENCES products (id),
        FOREIGN KEY (store_id) REFERENCES stores (id)
      );

      INSERT INTO notification_changes
        (id, notification_id, product_id, store_id, event_type,
         previous_price, new_price, decrease)
      SELECT id, notification_id, product_id, store_id, 'PRICE_DECREASE',
             previous_price, new_price, decrease
      FROM notification_changes_legacy;

      DROP TABLE notification_changes_legacy;
    `);
  });

  migrate();
}
