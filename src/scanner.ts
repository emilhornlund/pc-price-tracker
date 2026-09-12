import {
  fetchPrisjaktProductPage,
  parsePrisjaktProduct,
  type PrisjaktProduct,
} from './prisjakt';
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
}

export interface PersistedOffer {
  store: StoreRecord;
  observation: PriceObservationRecord;
}

export interface PersistedProductScan {
  product: ProductRecord;
  parsed: PrisjaktProduct;
  offers: PersistedOffer[];
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

  for (const offer of parsed.offers) {
    const storeId = offer.storeId ?? fallbackStoreId(offer.store);
    const store = stores.findOrCreate(storeId, offer.store);
    const observation = observations.create(product.id, store.id, offer.price);
    persistedOffers.push({ store, observation });
  }

  return { product, parsed, offers: persistedOffers };
}

export const persistScrapedProduct = scanProduct;

function fallbackStoreId(storeName: string): string {
  return `name:${storeName.trim().toLocaleLowerCase('sv-SE')}`;
}
