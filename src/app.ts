import {
  getDefaultConfigPath,
  loadConfig,
  resolveConfigSecrets,
  validateConfig,
} from './config';
import { closeDatabase, openDatabase } from './database';
import { createSmtpEmailSender } from './mailer';
import { NotificationRepository } from './notifications';
import { executeScan, type ScanExecutionResult } from './scanner';

export async function runManualScan(
  configPath = getDefaultConfigPath(),
): Promise<ScanExecutionResult> {
  const config = loadConfig(configPath);
  validateConfig(config);
  const credentials = resolveConfigSecrets(config);
  const database = openDatabase();

  try {
    const emailSender =
      config.notifications.email.enabled && credentials !== undefined
        ? createSmtpEmailSender(config.notifications.email, credentials)
        : undefined;

    return await executeScan(config.products, {
      database,
      emailSender,
      logger: console,
      notificationsEnabled: config.notifications.email.enabled,
      notificationRepository: new NotificationRepository(database),
    });
  } finally {
    closeDatabase(database);
  }
}
