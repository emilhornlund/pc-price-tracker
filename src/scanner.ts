import {
  fetchPrisjaktProductPage,
  parsePrisjaktProduct,
  type PrisjaktProduct,
} from './prisjakt';
import { buildPriceDecreaseEmail, type EmailContent } from './email';
import type { EmailSender } from './mailer';
import {
  NotificationRepository,
  type NotificationRecord,
} from './notifications';
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
  logger?: Pick<Console, 'error' | 'info'>;
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

export interface ScanExecutionDependencies extends ProductScanDependencies {
  emailSender?: EmailSender;
  notificationRepository?: NotificationRepository;
}

export interface ScanExecutionResult extends AggregateScanResult {
  emailSent: boolean;
  emailContent?: EmailContent;
  notification?: NotificationRecord;
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
  const logger = dependencies.logger ?? console;

  logger.info('Scan started');
  logger.info(`Products configured: ${productUrls.length}`);

  for (const productUrl of productUrls) {
    logger.info(`Product being processed: ${productUrl}`);
    try {
      const result = await scanProduct(productUrl, dependencies);
      successfulProducts.push(result);
      decreases.push(...result.decreases);
      logger.info(`Product title: ${result.product.title}`);
      logger.info(`Offers parsed: ${result.parsed.offers.length}`);
      logger.info(`Decreases detected: ${result.decreases.length}`);
    } catch (error) {
      const scanError = asError(error);
      logger.error(
        `Product scan failed for ${productUrl}: ${scanError.message}`,
      );
      failedProducts.push({ productUrl, error: scanError });
    }
  }

  logger.info(`Decreases detected: ${decreases.length}`);
  logger.info('Scan completed');
  return { successfulProducts, failedProducts, decreases };
}

export const scanConfiguredProducts = scanProducts;

export async function executeScan(
  productUrls: string[],
  dependencies: ScanExecutionDependencies,
): Promise<ScanExecutionResult> {
  const result = await scanProducts(productUrls, dependencies);
  const logger = dependencies.logger ?? console;

  if (result.decreases.length === 0) {
    logger.info('Email skipped: no price decreases');
    return { ...result, emailSent: false };
  }

  if (dependencies.emailSender === undefined) {
    const error = new Error(
      'Price decreases were detected but no email sender is configured',
    );
    logger.error(`Email failed: ${error.message}`);
    throw error;
  }

  const emailContent = buildPriceDecreaseEmail(result.decreases);
  try {
    await dependencies.emailSender.send(emailContent);
  } catch (error) {
    const sendError = asError(error);
    logger.error(`Email failed: ${sendError.message}`);
    throw sendError;
  }

  const notification =
    dependencies.notificationRepository === undefined
      ? undefined
      : dependencies.notificationRepository.createSentNotification(
          getNotificationChanges(result),
        );
  logger.info(`Email sent: ${result.decreases.length} price decreases`);
  return {
    ...result,
    emailSent: true,
    emailContent,
    ...(notification === undefined ? {} : { notification }),
  };
}

export const runScan = executeScan;

function fallbackStoreId(storeName: string): string {
  return `name:${storeName.trim().toLocaleLowerCase('sv-SE')}`;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function getNotificationChanges(result: AggregateScanResult) {
  return result.successfulProducts.flatMap((productScan) =>
    productScan.offers.flatMap((persistedOffer) => {
      const change = persistedOffer.change;
      return change === undefined
        ? []
        : [
            {
              productId: productScan.product.id,
              storeId: persistedOffer.store.id,
              previousPrice: change.previousPrice,
              newPrice: change.newPrice,
            },
          ];
    }),
  );
}
