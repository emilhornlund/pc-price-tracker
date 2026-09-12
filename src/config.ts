import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export const CONFIG_FILE_NAME = 'config.yaml';

export interface ScheduleConfig {
  cron: string;
  timezone: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  usernameEnv: string;
  passwordEnv: string;
  timeoutSeconds: number;
}

export interface EmailNotificationConfig {
  enabled: boolean;
  recipients: string[];
  from: string;
  smtp: SmtpConfig;
}

export interface NotificationsConfig {
  email: EmailNotificationConfig;
}

export interface AppConfig {
  products: string[];
  schedule: ScheduleConfig;
  notifications: NotificationsConfig;
}

export function getDefaultConfigPath(): string {
  return path.resolve(process.cwd(), CONFIG_FILE_NAME);
}

export function parseConfig(source: string): AppConfig {
  const parsed: unknown = yaml.load(source);

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Configuration must contain a YAML mapping at its root');
  }

  return parsed as AppConfig;
}

export function loadConfig(configPath = getDefaultConfigPath()): AppConfig {
  const resolvedPath = path.resolve(configPath);
  const source = readFileSync(resolvedPath, 'utf8');

  return parseConfig(source);
}
