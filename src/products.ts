import type { TrackerDatabase } from './database';

export interface ProductRecord {
  id: number;
  url: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductRow {
  id: number;
  url: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export class ProductRepository {
  public constructor(private readonly database: TrackerDatabase) {}

  public findById(id: number): ProductRecord | undefined {
    const row = this.database
      .prepare('SELECT * FROM products WHERE id = ?')
      .get(id) as ProductRow | undefined;
    return row === undefined ? undefined : mapProductRow(row);
  }

  public findByUrl(url: string): ProductRecord | undefined {
    const row = this.database
      .prepare('SELECT * FROM products WHERE url = ?')
      .get(url) as ProductRow | undefined;
    return row === undefined ? undefined : mapProductRow(row);
  }

  public create(url: string, title = ''): ProductRecord {
    const now = new Date().toISOString();
    const result = this.database
      .prepare(
        `
          INSERT INTO products (url, title, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `,
      )
      .run(url, title, now, now);

    return this.findById(Number(result.lastInsertRowid))!;
  }

  public updateTitle(id: number, title: string): ProductRecord {
    const existing = this.findById(id);
    if (existing === undefined) {
      throw new Error(`Product ${id} does not exist`);
    }

    const currentTime = Date.now();
    const previousTime = Date.parse(existing.updatedAt);
    const updatedAt = new Date(
      Math.max(currentTime, previousTime + 1),
    ).toISOString();
    const result = this.database
      .prepare('UPDATE products SET title = ?, updated_at = ? WHERE id = ?')
      .run(title, updatedAt, id);

    if (result.changes === 0) {
      throw new Error(`Product ${id} does not exist`);
    }

    return this.findById(id)!;
  }

  public findOrCreate(url: string, title = ''): ProductRecord {
    const existing = this.findByUrl(url);
    if (existing === undefined) {
      return this.create(url, title);
    }

    return title === existing.title
      ? existing
      : this.updateTitle(existing.id, title);
  }
}

function mapProductRow(row: ProductRow): ProductRecord {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
