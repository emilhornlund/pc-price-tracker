import path from 'node:path';

import {
  getDefaultConfigPath,
  loadConfig,
  resolveConfigSecrets,
  validateConfig,
} from './config';
import {
  closeDatabase,
  DEFAULT_DATABASE_PATH,
  openDatabase,
  type TrackerDatabase,
} from './database';
import { createSmtpEmailSender } from './mailer';
import { NotificationRepository } from './notifications';
import { executeScan, type ScanExecutionResult } from './scanner';
import { startScheduler, type ScanScheduler } from './scheduler';

export interface ApplicationOptions {
  databasePath?: string;
  logger?: Pick<Console, 'error' | 'info'>;
}

export interface Application {
  config: ReturnType<typeof loadConfig>;
  database: TrackerDatabase;
  runScan(): Promise<ScanExecutionResult>;
  startScheduled(): ScanScheduler;
  close(): void;
}

export function createApplication(
  configPath = getDefaultConfigPath(),
  options: ApplicationOptions = {},
): Application {
  const logger = options.logger ?? console;
  logger.info('PC Price Tracker starting');
  const config = loadConfig(configPath);
  validateConfig(config);
  const credentials = resolveConfigSecrets(config);
  logger.info('Configuration loaded');
  const database = openDatabase(
    options.databasePath ?? getDefaultApplicationDatabasePath(),
  );
  logger.info('Database initialized');
  const emailSender =
    config.notifications.email.enabled && credentials !== undefined
      ? createSmtpEmailSender(config.notifications.email, credentials)
      : undefined;
  logger.info(
    config.notifications.email.enabled
      ? 'Email notifications enabled'
      : 'Email notifications disabled',
  );
  const notificationRepository = new NotificationRepository(database);
  let scheduler: ScanScheduler | undefined;
  let closed = false;

  const runScan = (): Promise<ScanExecutionResult> =>
    executeScan(config.products, {
      database,
      emailSender,
      logger,
      notificationsEnabled: config.notifications.email.enabled,
      notificationRepository,
    });

  return {
    config,
    database,
    runScan,
    startScheduled: () => {
      if (closed) {
        throw new Error('Application is already closed');
      }
      if (scheduler === undefined) {
        scheduler = startScheduler(
          config.schedule,
          async () => {
            await runScan();
          },
          logger,
        );
        logger.info(`Scheduler initialized: ${config.schedule.cron}`);
        logger.info(`Scheduler timezone: ${config.schedule.timezone}`);
        logger.info('PC Price Tracker ready');
        logger.info('Waiting for scheduled scans');
      }
      return scheduler;
    },
    close: () => {
      if (closed) {
        return;
      }
      closed = true;
      if (scheduler !== undefined) {
        scheduler.stop();
        logger.info('Scheduler stopped during shutdown');
      }
      closeDatabase(database);
      logger.info('Database closed during shutdown');
      logger.info('Graceful shutdown completed');
    },
  };
}

function getDefaultApplicationDatabasePath(): string {
  return process.env.NODE_ENV === 'production'
    ? DEFAULT_DATABASE_PATH
    : path.resolve(process.cwd(), 'data', 'pc-price-tracker.db');
}

export async function runManualScan(
  configPath = getDefaultConfigPath(),
): Promise<ScanExecutionResult> {
  const application = createApplication(configPath);

  try {
    return await application.runScan();
  } finally {
    application.close();
  }
}
