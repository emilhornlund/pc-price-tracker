import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';

import {
  closeDatabase,
  DEFAULT_DATABASE_PATH,
  initializeDatabase,
  openDatabase,
} from '../src/database';

describe('SQLite database infrastructure', () => {
  it('opens an isolated in-memory database and enables foreign keys', () => {
    const database = openDatabase(':memory:');

    expect(database.prepare('SELECT 1 AS value').get()).toEqual({ value: 1 });
    expect(database.pragma('foreign_keys', { simple: true })).toBe(1);

    closeDatabase(database);
    expect(database.open).toBe(false);
  });

  it('creates parent directories for a configurable file database path', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'pc-price-tracker-'));
    const databasePath = path.join(directory, 'nested', 'tracker.db');
    const database = openDatabase(databasePath);

    expect(database.open).toBe(true);
    closeDatabase(database);
    rmSync(directory, { recursive: true, force: true });
  });

  it('uses the production database path by default', () => {
    expect(DEFAULT_DATABASE_PATH).toBe(
      '/opt/pc-price-tracker/data/pc-price-tracker.db',
    );
  });

  it('migrates existing decrease notifications without losing their details', () => {
    const database = new Database(':memory:');
    database.exec(`
      CREATE TABLE products (
        id INTEGER PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE stores (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE notifications (
        id INTEGER PRIMARY KEY,
        sent_at TEXT NOT NULL
      );
      CREATE TABLE notification_changes (
        id INTEGER PRIMARY KEY,
        notification_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        store_id TEXT NOT NULL,
        previous_price INTEGER NOT NULL,
        new_price INTEGER NOT NULL,
        decrease INTEGER NOT NULL
      );
      INSERT INTO products VALUES
        (1, 'https://www.prisjakt.nu/produkt.php?p=1', 'Product', 'now', 'now');
      INSERT INTO stores VALUES ( 'store-1', 'Store', 'now', 'now');
      INSERT INTO notifications VALUES (1, '2026-09-12T19:00:00.000Z');
      INSERT INTO notification_changes VALUES (1, 1, 1, 'store-1', 159900, 149900, 10000);
    `);

    initializeDatabase(database);

    expect(
      database
        .prepare(
          'SELECT event_type, previous_price, new_price, decrease FROM notification_changes',
        )
        .get(),
    ).toEqual({
      event_type: 'PRICE_DECREASE',
      previous_price: 159_900,
      new_price: 149_900,
      decrease: 10_000,
    });

    closeDatabase(database);
  });
});
