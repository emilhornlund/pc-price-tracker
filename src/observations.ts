import type { TrackerDatabase } from './database';

export interface PriceObservationRecord {
  id: number;
  productId: number;
  storeId: string;
  price: number;
  observedAt: string;
}

interface PriceObservationRow {
  id: number;
  product_id: number;
  store_id: string;
  price: number;
  observed_at: string;
}

export class PriceObservationRepository {
  public constructor(private readonly database: TrackerDatabase) {}

  public create(
    productId: number,
    storeId: string,
    price: number,
    observedAt = new Date().toISOString(),
  ): PriceObservationRecord {
    if (!Number.isSafeInteger(price) || price < 0) {
      throw new Error(
        'Price observations must use a non-negative integer price',
      );
    }

    const result = this.database
      .prepare(
        `
          INSERT INTO price_observations
            (product_id, store_id, price, observed_at)
          VALUES (?, ?, ?, ?)
        `,
      )
      .run(productId, storeId, price, observedAt);

    return this.findById(Number(result.lastInsertRowid))!;
  }

  public findById(id: number): PriceObservationRecord | undefined {
    const row = this.database
      .prepare('SELECT * FROM price_observations WHERE id = ?')
      .get(id) as PriceObservationRow | undefined;
    return row === undefined ? undefined : mapObservationRow(row);
  }

  public findLatest(
    productId: number,
    storeId: string,
  ): PriceObservationRecord | undefined {
    const row = this.database
      .prepare(
        `
          SELECT * FROM price_observations
          WHERE product_id = ? AND store_id = ?
          ORDER BY observed_at DESC, id DESC
          LIMIT 1
        `,
      )
      .get(productId, storeId) as PriceObservationRow | undefined;
    return row === undefined ? undefined : mapObservationRow(row);
  }

  public findForProductStore(
    productId: number,
    storeId: string,
  ): PriceObservationRecord[] {
    const rows = this.database
      .prepare(
        `
          SELECT * FROM price_observations
          WHERE product_id = ? AND store_id = ?
          ORDER BY observed_at ASC, id ASC
        `,
      )
      .all(productId, storeId) as PriceObservationRow[];
    return rows.map(mapObservationRow);
  }
}

function mapObservationRow(row: PriceObservationRow): PriceObservationRecord {
  return {
    id: row.id,
    productId: row.product_id,
    storeId: row.store_id,
    price: row.price,
    observedAt: row.observed_at,
  };
}
