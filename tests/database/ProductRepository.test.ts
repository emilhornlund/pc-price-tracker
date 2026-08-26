import { describe, expect, it } from "vitest";

import { ProductRepository } from "../../src/database/ProductRepository.js";
import { openDatabase } from "../../src/database/database.js";

describe("ProductRepository", () => {
  it("inserts a product", () => {
    const database = openDatabase(":memory:");

    try {
      const repository = new ProductRepository(database);

      repository.upsert(
        {
          prisjaktId: "14547423",
          category: "memory",
          name: "Crucial Pro OC DDR5 6000MHz 2x32GB",
          url: "https://www.prisjakt.nu/produkt.php?p=14547423",
        },
        "2026-08-25T10:00:00.000Z",
      );

      const product = database
        .prepare(
          `
          SELECT
            prisjakt_id,
            category,
            name,
            url,
            first_seen_at,
            last_seen_at
          FROM products
        `,
        )
        .get();

      expect(product).toEqual({
        prisjakt_id: "14547423",
        category: "memory",
        name: "Crucial Pro OC DDR5 6000MHz 2x32GB",
        url: "https://www.prisjakt.nu/produkt.php?p=14547423",
        first_seen_at: "2026-08-25T10:00:00.000Z",
        last_seen_at: "2026-08-25T10:00:00.000Z",
      });
    } finally {
      database.close();
    }
  });

  it("updates a rediscovered product without duplicating it", () => {
    const database = openDatabase(":memory:");

    try {
      const repository = new ProductRepository(database);

      repository.upsert(
        {
          prisjaktId: "14547423",
          category: "memory",
          name: "Original name",
          url: "https://www.prisjakt.nu/produkt.php?p=14547423",
        },
        "2026-08-25T10:00:00.000Z",
      );

      repository.upsert(
        {
          prisjaktId: "14547423",
          category: "memory",
          name: "Updated name",
          url: "https://www.prisjakt.nu/produkt.php?p=14547423&updated=true",
        },
        "2026-08-26T10:00:00.000Z",
      );

      const count = database
        .prepare("SELECT COUNT(*) AS count FROM products")
        .get();

      expect(count?.count).toBe(1);

      const product = database
        .prepare(
          `
          SELECT
            prisjakt_id,
            category,
            name,
            url,
            first_seen_at,
            last_seen_at
          FROM products
        `,
        )
        .get();

      expect(product).toEqual({
        prisjakt_id: "14547423",
        category: "memory",
        name: "Updated name",
        url: "https://www.prisjakt.nu/produkt.php?p=14547423&updated=true",
        first_seen_at: "2026-08-25T10:00:00.000Z",
        last_seen_at: "2026-08-26T10:00:00.000Z",
      });
    } finally {
      database.close();
    }
  });

  it("returns the first persisted product", () => {
    const database = openDatabase(":memory:");

    try {
      const repository = new ProductRepository(database);

      repository.upsert(
        {
          prisjaktId: "14547423",
          category: "memory",
          name: "Crucial Pro OC DDR5 6000MHz 2x32GB",
          url: "https://www.prisjakt.nu/produkt.php?p=14547423",
        },
        "2026-08-25T10:00:00.000Z",
      );

      const product = repository.findFirst();

      expect(product).toEqual({
        id: 1,
        prisjaktId: "14547423",
        category: "memory",
        name: "Crucial Pro OC DDR5 6000MHz 2x32GB",
        url: "https://www.prisjakt.nu/produkt.php?p=14547423",
      });
    } finally {
      database.close();
    }
  });

  it("persists product details for a product", () => {
    const database = openDatabase(":memory:");

    try {
      const repository = new ProductRepository(database);

      repository.upsert(
        {
          prisjaktId: "14547423",
          category: "memory",
          name: "Crucial Pro OC DDR5 6000MHz 2x32GB",
          url: "https://www.prisjakt.nu/produkt.php?p=14547423",
        },
        "2026-08-25T10:00:00.000Z",
      );

      const product = repository.findFirst();

      expect(product).toBeDefined();

      repository.upsertDetails(product!.id, {
        brand: "Crucial",
        description: "Product description",
        imageUrl: "https://cdn.pji.nu/product/standard/800/14547423.jpg",
      });

      const details = database
        .prepare(
          `
          SELECT
            product_id,
            brand,
            description,
            image_url
          FROM product_details
        `,
        )
        .get();

      expect(details).toEqual({
        product_id: product!.id,
        brand: "Crucial",
        description: "Product description",
        image_url: "https://cdn.pji.nu/product/standard/800/14547423.jpg",
      });
    } finally {
      database.close();
    }
  });

  it("persists stores, product offers, and price observations", () => {
    const database = openDatabase(":memory:");

    try {
      const repository = new ProductRepository(database);

      repository.upsert(
        {
          prisjaktId: "14547423",
          category: "memory",
          name: "Crucial Pro OC DDR5 6000MHz 2x32GB",
          url: "https://www.prisjakt.nu/produkt.php?p=14547423",
        },
        "2026-08-25T10:00:00.000Z",
      );

      repository.upsertOffers(
        1,
        [
          {
            shopId: 429,
            shopName: "CDON",
            shopOfferId: "offer-a",
            priceSek: 11287,
          },
          {
            shopId: 429,
            shopName: "CDON",
            shopOfferId: "offer-b",
            priceSek: 12089,
          },
          {
            shopId: 5332,
            shopName: "Multitech Data",
            shopOfferId: "33249",
            priceSek: 9290,
          },
        ],
        "2026-08-26T10:00:00.000Z",
      );

      const stores = database
        .prepare(
          `
          SELECT prisjakt_shop_id, name, first_seen_at, last_seen_at
          FROM stores
          ORDER BY id
        `,
        )
        .all();
      const offers = database
        .prepare(
          `
          SELECT
            product_id,
            store_id,
            shop_offer_id,
            first_seen_at,
            last_seen_at
          FROM product_offers
          ORDER BY id
        `,
        )
        .all();
      const observations = database
        .prepare(
          `
          SELECT product_offer_id, observed_at, price_sek
          FROM price_observations
          ORDER BY id
        `,
        )
        .all();

      expect(stores).toEqual([
        {
          prisjakt_shop_id: 429,
          name: "CDON",
          first_seen_at: "2026-08-26T10:00:00.000Z",
          last_seen_at: "2026-08-26T10:00:00.000Z",
        },
        {
          prisjakt_shop_id: 5332,
          name: "Multitech Data",
          first_seen_at: "2026-08-26T10:00:00.000Z",
          last_seen_at: "2026-08-26T10:00:00.000Z",
        },
      ]);
      expect(offers).toEqual([
        {
          product_id: 1,
          store_id: 1,
          shop_offer_id: "offer-a",
          first_seen_at: "2026-08-26T10:00:00.000Z",
          last_seen_at: "2026-08-26T10:00:00.000Z",
        },
        {
          product_id: 1,
          store_id: 1,
          shop_offer_id: "offer-b",
          first_seen_at: "2026-08-26T10:00:00.000Z",
          last_seen_at: "2026-08-26T10:00:00.000Z",
        },
        {
          product_id: 1,
          store_id: 2,
          shop_offer_id: "33249",
          first_seen_at: "2026-08-26T10:00:00.000Z",
          last_seen_at: "2026-08-26T10:00:00.000Z",
        },
      ]);
      expect(observations).toEqual([
        {
          product_offer_id: 1,
          observed_at: "2026-08-26T10:00:00.000Z",
          price_sek: 11287,
        },
        {
          product_offer_id: 2,
          observed_at: "2026-08-26T10:00:00.000Z",
          price_sek: 12089,
        },
        {
          product_offer_id: 3,
          observed_at: "2026-08-26T10:00:00.000Z",
          price_sek: 9290,
        },
      ]);
    } finally {
      database.close();
    }
  });

  it("keeps one product offer while recording later price observations", () => {
    const database = openDatabase(":memory:");

    try {
      const repository = new ProductRepository(database);

      repository.upsert(
        {
          prisjaktId: "14547423",
          category: "memory",
          name: "Crucial Pro OC DDR5 6000MHz 2x32GB",
          url: "https://www.prisjakt.nu/produkt.php?p=14547423",
        },
        "2026-08-25T10:00:00.000Z",
      );

      repository.upsertOffers(
        1,
        [
          {
            shopId: 429,
            shopName: "CDON",
            shopOfferId: "offer-a",
            priceSek: 11287,
          },
        ],
        "2026-08-26T10:00:00.000Z",
      );
      repository.upsertOffers(
        1,
        [
          {
            shopId: 429,
            shopName: "CDON Marketplace",
            shopOfferId: "offer-a",
            priceSek: 10999,
          },
        ],
        "2026-08-27T10:00:00.000Z",
      );

      const counts = database
        .prepare(
          `
          SELECT
            (SELECT COUNT(*) FROM stores) AS store_count,
            (SELECT COUNT(*) FROM product_offers) AS offer_count,
            (SELECT COUNT(*) FROM price_observations) AS observation_count
        `,
        )
        .get();
      const offer = database
        .prepare(
          `
          SELECT first_seen_at, last_seen_at
          FROM product_offers
        `,
        )
        .get();
      const observations = database
        .prepare(
          `
          SELECT observed_at, price_sek
          FROM price_observations
          ORDER BY id
        `,
        )
        .all();

      expect(counts).toEqual({
        store_count: 1,
        offer_count: 1,
        observation_count: 2,
      });
      expect(offer).toEqual({
        first_seen_at: "2026-08-26T10:00:00.000Z",
        last_seen_at: "2026-08-27T10:00:00.000Z",
      });
      expect(observations).toEqual([
        { observed_at: "2026-08-26T10:00:00.000Z", price_sek: 11287 },
        { observed_at: "2026-08-27T10:00:00.000Z", price_sek: 10999 },
      ]);
    } finally {
      database.close();
    }
  });
});
