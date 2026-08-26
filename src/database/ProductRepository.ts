import type { DatabaseSync } from "node:sqlite";

import type { ComponentCategory } from "../domain/ComponentCategory.js";
import type { PrisjaktProductOffer } from "../prisjakt/types.js";

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
  private readonly database: DatabaseSync;
  private readonly upsertStatement;
  private readonly findFirstStatement;
  private readonly upsertDetailsStatement;
  private readonly upsertStoreStatement;
  private readonly findStoreIdStatement;
  private readonly upsertProductOfferStatement;
  private readonly findProductOfferIdStatement;
  private readonly upsertPriceObservationStatement;

  public constructor(database: DatabaseSync) {
    this.database = database;

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

    this.upsertStoreStatement = database.prepare(`
      INSERT INTO stores (
        prisjakt_shop_id,
        name,
        first_seen_at,
        last_seen_at
      )
      VALUES (?, ?, ?, ?)
      ON CONFLICT(prisjakt_shop_id) DO UPDATE SET
        name = excluded.name,
        last_seen_at = excluded.last_seen_at
    `);

    this.findStoreIdStatement = database.prepare(`
      SELECT id
      FROM stores
      WHERE prisjakt_shop_id = ?
    `);

    this.upsertProductOfferStatement = database.prepare(`
      INSERT INTO product_offers (
        product_id,
        store_id,
        shop_offer_id,
        first_seen_at,
        last_seen_at
      )
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(product_id, store_id, shop_offer_id) DO UPDATE SET
        last_seen_at = excluded.last_seen_at
    `);

    this.findProductOfferIdStatement = database.prepare(`
      SELECT id
      FROM product_offers
      WHERE product_id = ?
        AND store_id = ?
        AND shop_offer_id = ?
    `);

    this.upsertPriceObservationStatement = database.prepare(`
      INSERT INTO price_observations (
        product_offer_id,
        observed_at,
        price_sek
      )
      VALUES (?, ?, ?)
      ON CONFLICT(product_offer_id, observed_at) DO UPDATE SET
        price_sek = excluded.price_sek
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

  public upsertOffers(
    productId: number,
    offers: PrisjaktProductOffer[],
    observedAt: string,
  ): void {
    this.database.exec("BEGIN");

    try {
      for (const offer of offers) {
        this.upsertStoreStatement.run(
          offer.shopId,
          offer.shopName,
          observedAt,
          observedAt,
        );

        const store = this.findStoreIdStatement.get(offer.shopId);

        if (store === undefined) {
          throw new Error(
            `Store ${offer.shopId} was not found after being upserted`,
          );
        }

        const storeId = Number(store.id);

        this.upsertProductOfferStatement.run(
          productId,
          storeId,
          offer.shopOfferId,
          observedAt,
          observedAt,
        );

        const productOffer = this.findProductOfferIdStatement.get(
          productId,
          storeId,
          offer.shopOfferId,
        );

        if (productOffer === undefined) {
          throw new Error(
            `Product offer ${offer.shopOfferId} was not found after being upserted`,
          );
        }

        this.upsertPriceObservationStatement.run(
          Number(productOffer.id),
          observedAt,
          offer.priceSek,
        );
      }

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}
