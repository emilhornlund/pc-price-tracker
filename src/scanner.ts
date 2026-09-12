import {
  fetchPrisjaktProductPage,
  parsePrisjaktProduct,
  type PrisjaktProduct,
} from './prisjakt';
import { detectPriceDecrease, type PriceDecrease } from './price-changes';
import type { TrackerDatabase } from './database';
import {
  PriceObservationRepository,
  type PriceObservationRecord,
} from './observations';
import { ProductRepository, type ProductRecord } from './products';
import { StoreRepository, type StoreRecord } from './stores';

export interface ProductScanDependencies {
  database: TrackerDatabase;
  fetchPage?: (productUrl: string) => Promise<string>;
  parsePage?: (html: string) => PrisjaktProduct;
  logger?: Pick<Console, 'error'>;
}

export interface PersistedOffer {
  store: StoreRecord;
  observation: PriceObservationRecord;
  change?: PriceDecrease;
}

export interface PersistedProductScan {
  product: ProductRecord;
  parsed: PrisjaktProduct;
  offers: PersistedOffer[];
  decreases: PriceDecrease[];
}

export interface FailedProductScan {
  productUrl: string;
  error: Error;
}

export interface AggregateScanResult {
  successfulProducts: PersistedProductScan[];
  failedProducts: FailedProductScan[];
  decreases: PriceDecrease[];
}

export async function scanProduct(
  productUrl: string,
  dependencies: ProductScanDependencies,
): Promise<PersistedProductScan> {
  const fetchPage = dependencies.fetchPage ?? fetchPrisjaktProductPage;
  const parsePage = dependencies.parsePage ?? parsePrisjaktProduct;
  const html = await fetchPage(productUrl);
  const parsed = parsePage(html);
  const products = new ProductRepository(dependencies.database);
  const stores = new StoreRepository(dependencies.database);
  const observations = new PriceObservationRepository(dependencies.database);
  const product = products.findOrCreate(productUrl, parsed.title);
  const persistedOffers: PersistedOffer[] = [];
  const decreases: PriceDecrease[] = [];

  for (const offer of parsed.offers) {
    const storeId = offer.storeId ?? fallbackStoreId(offer.store);
    const store = stores.findOrCreate(storeId, offer.store);
    const previousObservation = observations.findLatest(product.id, store.id);
    const change = detectPriceDecrease(
      product.title,
      store.name,
      previousObservation?.price,
      offer.price,
    );
    const observation = observations.create(product.id, store.id, offer.price);
    if (change !== undefined) {
      decreases.push(change);
    }
    persistedOffers.push({
      store,
      observation,
      ...(change === undefined ? {} : { change }),
    });
  }

  return { product, parsed, offers: persistedOffers, decreases };
}

export const persistScrapedProduct = scanProduct;

export async function scanProducts(
  productUrls: string[],
  dependencies: ProductScanDependencies,
): Promise<AggregateScanResult> {
  const successfulProducts: PersistedProductScan[] = [];
  const failedProducts: FailedProductScan[] = [];
  const decreases: PriceDecrease[] = [];

  for (const productUrl of productUrls) {
    try {
      const result = await scanProduct(productUrl, dependencies);
      successfulProducts.push(result);
      decreases.push(...result.decreases);
    } catch (error) {
      const scanError = asError(error);
      (dependencies.logger ?? console).error(
        `Product scan failed for ${productUrl}: ${scanError.message}`,
      );
      failedProducts.push({ productUrl, error: scanError });
    }
  }

  return { successfulProducts, failedProducts, decreases };
}

export const scanConfiguredProducts = scanProducts;

function fallbackStoreId(storeName: string): string {
  return `name:${storeName.trim().toLocaleLowerCase('sv-SE')}`;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
