import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  closeDatabase,
  DEFAULT_DATABASE_PATH,
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
});
