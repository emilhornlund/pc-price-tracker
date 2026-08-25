import type { DatabaseSync } from "node:sqlite";

export interface ProductSummary {
  prisjaktId: string;
  name: string;
  url: string;
}

export class ProductRepository {
  private readonly upsertStatement;

  public constructor(database: DatabaseSync) {
    this.upsertStatement = database.prepare(`
      INSERT INTO products (
        prisjakt_id,
        name,
        url,
        first_seen_at,
        last_seen_at
      )
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(prisjakt_id) DO UPDATE SET
        name = excluded.name,
        url = excluded.url,
        last_seen_at = excluded.last_seen_at
    `);
  }

  public upsert(product: ProductSummary, seenAt: string): void {
    this.upsertStatement.run(
      product.prisjaktId,
      product.name,
      product.url,
      seenAt,
      seenAt,
    );
  }
}
