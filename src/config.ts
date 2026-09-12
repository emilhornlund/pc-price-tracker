import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export const CONFIG_FILE_NAME = 'config.yaml';
export const DEFAULT_CONTAINER_CONFIG_PATH =
  '/opt/pc-price-tracker/config.yaml';

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

export interface SmtpCredentials {
  username: string;
  password: string;
}

export class ConfigValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(
      [
        'Invalid application configuration:',
        ...issues.map((issue) => `- ${issue}`),
      ].join('\n'),
    );
    this.name = 'ConfigValidationError';
  }
}

export class ConfigSecretResolutionError extends Error {
  constructor(public readonly missingVariables: string[]) {
    super(
      [
        'Missing required SMTP environment variables:',
        ...missingVariables.map((variable) => `- ${variable}`),
      ].join('\n'),
    );
    this.name = 'ConfigSecretResolutionError';
  }
}

export function getDefaultConfigPath(): string {
  if (process.cwd() === path.dirname(DEFAULT_CONTAINER_CONFIG_PATH)) {
    return DEFAULT_CONTAINER_CONFIG_PATH;
  }

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

export function resolveConfigSecrets(
  config: AppConfig,
  environment: NodeJS.ProcessEnv = process.env,
): SmtpCredentials | undefined {
  const email = config.notifications.email;

  if (!email.enabled) {
    return undefined;
  }

  const username = environment[email.smtp.usernameEnv];
  const password = environment[email.smtp.passwordEnv];
  const missingVariables = [
    username === undefined || username.trim() === ''
      ? email.smtp.usernameEnv
      : undefined,
    password === undefined || password.trim() === ''
      ? email.smtp.passwordEnv
      : undefined,
  ].filter((variable): variable is string => variable !== undefined);

  if (missingVariables.length > 0) {
    throw new ConfigSecretResolutionError([...new Set(missingVariables)]);
  }

  return {
    username: username!,
    password: password!,
  };
}

export function validateConfig(config: unknown): asserts config is AppConfig {
  const issues: string[] = [];

  if (!isRecord(config)) {
    throw new ConfigValidationError([
      'configuration must contain a mapping at its root',
    ]);
  }

  validateProducts(config.products, issues);
  validateSchedule(config.schedule, issues);
  validateNotifications(config.notifications, issues);

  if (issues.length > 0) {
    throw new ConfigValidationError(issues);
  }
}

function validateProducts(products: unknown, issues: string[]): void {
  if (!Array.isArray(products)) {
    issues.push('products must be an array');
    return;
  }

  if (products.length === 0) {
    issues.push('products must contain at least one product URL');
    return;
  }

  const seenProducts = new Map<string, number>();

  products.forEach((product, index) => {
    if (typeof product !== 'string' || !isPrisjaktProductUrl(product)) {
      issues.push(`products[${index}] must be a valid Prisjakt product URL`);
      return;
    }

    const firstIndex = seenProducts.get(product);
    if (firstIndex !== undefined) {
      issues.push(
        `products[${index}] duplicates the product URL at products[${firstIndex}]`,
      );
      return;
    }

    seenProducts.set(product, index);
  });
}

function validateSchedule(schedule: unknown, issues: string[]): void {
  if (!isRecord(schedule)) {
    issues.push('schedule must be configured');
    return;
  }

  if (typeof schedule.cron !== 'string' || schedule.cron.trim() === '') {
    issues.push('schedule.cron must be a non-empty string');
  } else if (!isValidCron(schedule.cron)) {
    issues.push('schedule.cron must be a valid five-field cron expression');
  }

  if (
    typeof schedule.timezone !== 'string' ||
    schedule.timezone.trim() === ''
  ) {
    issues.push('schedule.timezone must be a non-empty IANA timezone');
  } else if (!isValidTimezone(schedule.timezone)) {
    issues.push(
      `schedule.timezone is not a valid IANA timezone: ${schedule.timezone}`,
    );
  }
}

function validateNotifications(notifications: unknown, issues: string[]): void {
  if (!isRecord(notifications)) {
    issues.push('notifications must be configured');
    return;
  }

  if (!isRecord(notifications.email)) {
    issues.push('notifications.email must be configured');
    return;
  }

  if (typeof notifications.email.enabled !== 'boolean') {
    issues.push('notifications.email.enabled must be a boolean');
    return;
  }

  if (notifications.email.enabled) {
    validateEnabledEmail(notifications.email, issues);
  }
}

function validateEnabledEmail(
  email: Record<string, unknown>,
  issues: string[],
): void {
  if (!Array.isArray(email.recipients) || email.recipients.length === 0) {
    issues.push(
      'notifications.email.recipients must contain at least one recipient when email is enabled',
    );
  } else {
    email.recipients.forEach((recipient, index) => {
      if (typeof recipient !== 'string' || recipient.trim() === '') {
        issues.push(
          `notifications.email.recipients[${index}] must be a non-empty string`,
        );
      }
    });
  }

  if (typeof email.from !== 'string' || email.from.trim() === '') {
    issues.push(
      'notifications.email.from must be a non-empty sender when email is enabled',
    );
  }

  if (!isRecord(email.smtp)) {
    issues.push(
      'notifications.email.smtp must be configured when email is enabled',
    );
    return;
  }

  const smtp = email.smtp;

  if (!isNonEmptyString(smtp.host) || /\s/.test(smtp.host)) {
    issues.push('notifications.email.smtp.host must be a valid host');
  }

  if (
    typeof smtp.port !== 'number' ||
    !Number.isInteger(smtp.port) ||
    smtp.port < 1 ||
    smtp.port > 65535
  ) {
    issues.push(
      'notifications.email.smtp.port must be an integer between 1 and 65535',
    );
  }

  if (typeof smtp.secure !== 'boolean') {
    issues.push('notifications.email.smtp.secure must be a boolean');
  }

  if (!isEnvironmentVariableName(smtp.usernameEnv)) {
    issues.push(
      'notifications.email.smtp.usernameEnv must be a valid environment variable name',
    );
  }

  if (!isEnvironmentVariableName(smtp.passwordEnv)) {
    issues.push(
      'notifications.email.smtp.passwordEnv must be a valid environment variable name',
    );
  }

  if (
    typeof smtp.timeoutSeconds !== 'number' ||
    !Number.isFinite(smtp.timeoutSeconds) ||
    smtp.timeoutSeconds <= 0
  ) {
    issues.push(
      'notifications.email.smtp.timeoutSeconds must be a positive number',
    );
  }
}

function isPrisjaktProductUrl(value: string): boolean {
  if (value.trim() !== value) {
    return false;
  }

  try {
    const url = new URL(value);
    const productId = url.searchParams.get('p');

    return (
      url.protocol === 'https:' &&
      (url.hostname === 'www.prisjakt.nu' || url.hostname === 'prisjakt.nu') &&
      url.pathname === '/produkt.php' &&
      url.searchParams.getAll('p').length === 1 &&
      productId !== null &&
      /^[1-9]\d*$/.test(productId)
    );
  } catch {
    return false;
  }
}

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function isValidCron(value: string): boolean {
  const fields = value.trim().split(/\s+/);

  if (fields.length !== 5) {
    return false;
  }

  const ranges: [number, number, Record<string, number>?][] = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12, monthAliases],
    [0, 7, weekdayAliases],
  ];

  return fields.every((field, index) =>
    isValidCronField(
      field,
      ranges[index][0],
      ranges[index][1],
      ranges[index][2],
    ),
  );
}

function isValidCronField(
  field: string,
  minimum: number,
  maximum: number,
  aliases?: Record<string, number>,
): boolean {
  return field.split(',').every((part) => {
    if (part === '') {
      return false;
    }

    const segments = part.split('/');
    if (segments.length > 2) {
      return false;
    }

    if (segments.length === 2) {
      const step = Number(segments[1]);
      if (!Number.isInteger(step) || step < 1) {
        return false;
      }
    }

    const range = segments[0];
    if (range === '*') {
      return true;
    }

    const values = range.split('-');
    if (values.length > 2 || values.some((value) => value === '')) {
      return false;
    }

    const start = parseCronValue(values[0], aliases);
    const end =
      values.length === 2 ? parseCronValue(values[1], aliases) : start;

    return (
      start !== undefined &&
      end !== undefined &&
      start >= minimum &&
      start <= maximum &&
      end >= minimum &&
      end <= maximum &&
      start <= end
    );
  });
}

function parseCronValue(
  value: string,
  aliases?: Record<string, number>,
): number | undefined {
  if (aliases !== undefined) {
    const aliasValue = aliases[value.toUpperCase()];
    if (aliasValue !== undefined) {
      return aliasValue;
    }
  }

  if (!/^\d+$/.test(value)) {
    return undefined;
  }

  return Number(value);
}

function isEnvironmentVariableName(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const monthAliases: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const weekdayAliases: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};
