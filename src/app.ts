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
  const config = loadConfig(configPath);
  validateConfig(config);
  const credentials = resolveConfigSecrets(config);
  const database = openDatabase(options.databasePath ?? DEFAULT_DATABASE_PATH);
  const logger = options.logger ?? console;
  const emailSender =
    config.notifications.email.enabled && credentials !== undefined
      ? createSmtpEmailSender(config.notifications.email, credentials)
      : undefined;
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
      scheduler ??= startScheduler(
        config.schedule,
        async () => {
          await runScan();
        },
        logger,
      );
      return scheduler;
    },
    close: () => {
      if (closed) {
        return;
      }
      closed = true;
      scheduler?.stop();
      closeDatabase(database);
    },
  };
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
