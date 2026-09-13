import {
  fetchPrisjaktProductPage,
  parsePrisjaktProduct,
  type PrisjaktProduct,
} from './prisjakt';
import { buildPriceEventsEmail, type EmailContent } from './email';
import type { EmailSender } from './mailer';
import {
  NotificationRepository,
  type NotificationEventInput,
  type NotificationRecord,
} from './notifications';
import { detectPriceEvent, type PriceEvent } from './price-changes';
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
  event?: PriceEvent;
}

export interface PersistedProductScan {
  product: ProductRecord;
  parsed: PrisjaktProduct;
  offers: PersistedOffer[];
  priceEvents: PriceEvent[];
}

export interface FailedProductScan {
  productUrl: string;
  error: Error;
}

export interface AggregateScanResult {
  successfulProducts: PersistedProductScan[];
  failedProducts: FailedProductScan[];
  priceEvents: PriceEvent[];
}

export interface ScanExecutionDependencies extends ProductScanDependencies {
  emailSender?: EmailSender;
  notificationRepository?: NotificationRepository;
  notificationsEnabled?: boolean;
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
  const priceEvents: PriceEvent[] = [];

  for (const offer of parsed.offers) {
    const storeId = offer.storeId ?? fallbackStoreId(offer.store);
    const store = stores.findOrCreate(storeId, offer.store);
    const previousObservation = observations.findLatest(product.id, store.id);
    const event = detectPriceEvent(
      product.title,
      store.name,
      previousObservation?.price,
      offer.price,
    );
    const observation = observations.create(product.id, store.id, offer.price);
    if (event !== undefined) {
      priceEvents.push(event);
    }
    persistedOffers.push({
      store,
      observation,
      ...(event === undefined ? {} : { event }),
    });
  }

  return { product, parsed, offers: persistedOffers, priceEvents };
}

export const persistScrapedProduct = scanProduct;

export async function scanProducts(
  productUrls: string[],
  dependencies: ProductScanDependencies,
): Promise<AggregateScanResult> {
  const successfulProducts: PersistedProductScan[] = [];
  const failedProducts: FailedProductScan[] = [];
  const priceEvents: PriceEvent[] = [];
  const logger = dependencies.logger ?? console;

  logger.info('Scan started');
  logger.info(`Products configured: ${productUrls.length}`);

  for (const productUrl of productUrls) {
    logger.info(`Product being processed: ${productUrl}`);
    try {
      const result = await scanProduct(productUrl, dependencies);
      successfulProducts.push(result);
      priceEvents.push(...result.priceEvents);
      logger.info(`Product title: ${result.product.title}`);
      logger.info(`Offers parsed: ${result.parsed.offers.length}`);
    } catch (error) {
      const scanError = asError(error);
      logger.error(
        `Product scan failed for ${productUrl}: ${scanError.message}`,
      );
      failedProducts.push({ productUrl, error: scanError });
    }
  }

  logger.info(`Price events detected: ${priceEvents.length}`);
  logger.info('Scan completed');
  return { successfulProducts, failedProducts, priceEvents };
}

export const scanConfiguredProducts = scanProducts;

export async function executeScan(
  productUrls: string[],
  dependencies: ScanExecutionDependencies,
): Promise<ScanExecutionResult> {
  const result = await scanProducts(productUrls, dependencies);
  const logger = dependencies.logger ?? console;

  if (result.priceEvents.length === 0) {
    logger.info('Email skipped: no price events');
    return { ...result, emailSent: false };
  }

  if (dependencies.notificationsEnabled === false) {
    logger.info('Email skipped: notifications are disabled');
    return { ...result, emailSent: false };
  }

  if (dependencies.emailSender === undefined) {
    const error = new Error(
      'Price events were detected but no email sender is configured',
    );
    logger.error(`Email failed: ${error.message}`);
    throw error;
  }

  const emailContent = buildPriceEventsEmail(result.priceEvents);
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
          getNotificationEvents(result),
        );
  logger.info(`Email sent: ${result.priceEvents.length} price events`);
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

function getNotificationEvents(
  result: AggregateScanResult,
): NotificationEventInput[] {
  return result.successfulProducts.flatMap((productScan) =>
    productScan.offers.flatMap((persistedOffer) => {
      const event = persistedOffer.event;
      if (event === undefined) {
        return [];
      }

      const notificationEvent: NotificationEventInput =
        event.type === 'FIRST_OBSERVED'
          ? {
              type: 'FIRST_OBSERVED',
              productId: productScan.product.id,
              storeId: persistedOffer.store.id,
              currentPrice: event.currentPrice,
            }
          : {
              type: 'PRICE_DECREASE',
              productId: productScan.product.id,
              storeId: persistedOffer.store.id,
              previousPrice: event.previousPrice,
              newPrice: event.newPrice,
            };

      return [notificationEvent];
    }),
  );
}
