import type { DatabaseSync } from "node:sqlite";

import type { ComponentCategory } from "../domain/ComponentCategory.js";

export interface ProductSummary {
  prisjaktId: string;
  category: ComponentCategory;
  name: string;
  url: string;
}

export interface PersistedProduct extends ProductSummary {
  id: number;
}

export interface ProductDetails {
  brand: string;
  description: string;
  imageUrl: string;
}

export class ProductRepository {
  private readonly upsertStatement;
  private readonly findFirstStatement;
  private readonly upsertDetailsStatement;

  public constructor(database: DatabaseSync) {
    this.upsertStatement = database.prepare(`
      INSERT INTO products (
        prisjakt_id,
        category,
        name,
        url,
        first_seen_at,
        last_seen_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(prisjakt_id) DO UPDATE SET
        category = excluded.category,
        name = excluded.name,
        url = excluded.url,
        last_seen_at = excluded.last_seen_at
    `);

    this.findFirstStatement = database.prepare(`
      SELECT
        id,
        prisjakt_id,
        category,
        name,
        url
      FROM products
      ORDER BY id
      LIMIT 1
    `);

    this.upsertDetailsStatement = database.prepare(`
      INSERT INTO product_details (
        product_id,
        brand,
        description,
        image_url
      )
      VALUES (?, ?, ?, ?)
      ON CONFLICT(product_id) DO UPDATE SET
        brand = excluded.brand,
        description = excluded.description,
        image_url = excluded.image_url
    `);
  }

  public upsert(product: ProductSummary, seenAt: string): void {
    this.upsertStatement.run(
      product.prisjaktId,
      product.category,
      product.name,
      product.url,
      seenAt,
      seenAt,
    );
  }

  public findFirst(): PersistedProduct | undefined {
    const row = this.findFirstStatement.get();

    if (row === undefined) {
      return undefined;
    }

    return {
      id: Number(row.id),
      prisjaktId: String(row.prisjakt_id),
      category: String(row.category) as ComponentCategory,
      name: String(row.name),
      url: String(row.url),
    };
  }

  public upsertDetails(productId: number, details: ProductDetails): void {
    this.upsertDetailsStatement.run(
      productId,
      details.brand,
      details.description,
      details.imageUrl,
    );
  }
}
