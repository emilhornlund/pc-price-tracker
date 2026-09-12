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
