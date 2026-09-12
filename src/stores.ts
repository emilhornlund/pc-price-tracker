import type { TrackerDatabase } from './database';

export interface StoreRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface StoreRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export class StoreRepository {
  public constructor(private readonly database: TrackerDatabase) {}

  public findById(id: string): StoreRecord | undefined {
    const row = this.database
      .prepare('SELECT * FROM stores WHERE id = ?')
      .get(id) as StoreRow | undefined;
    return row === undefined ? undefined : mapStoreRow(row);
  }

  public create(id: string, name: string): StoreRecord {
    const now = new Date().toISOString();
    this.database
      .prepare(
        `
          INSERT INTO stores (id, name, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `,
      )
      .run(id, name, now, now);

    return this.findById(id)!;
  }

  public updateName(id: string, name: string): StoreRecord {
    const existing = this.findById(id);
    if (existing === undefined) {
      throw new Error(`Store ${id} does not exist`);
    }

    const updatedAt = new Date(
      Math.max(Date.now(), Date.parse(existing.updatedAt) + 1),
    ).toISOString();
    this.database
      .prepare('UPDATE stores SET name = ?, updated_at = ? WHERE id = ?')
      .run(name, updatedAt, id);

    return this.findById(id)!;
  }

  public findOrCreate(id: string, name: string): StoreRecord {
    const existing = this.findById(id);
    if (existing === undefined) {
      return this.create(id, name);
    }

    return existing.name === name ? existing : this.updateName(id, name);
  }
}

function mapStoreRow(row: StoreRow): StoreRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
