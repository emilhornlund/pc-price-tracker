import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  AppConfig,
  getDefaultConfigPath,
  loadConfig,
  validateConfig,
} from '../src/config';

describe('configuration loading', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(
      path.join(os.tmpdir(), 'pc-price-tracker-'),
    );
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('loads the typed configuration from an explicit YAML path', () => {
    const configPath = path.join(temporaryDirectory, 'local-config.yaml');
    const source = `
products:
  - https://www.prisjakt.nu/produkt.php?p=13438192

schedule:
  cron: '0 7,19 * * *'
  timezone: 'Europe/Stockholm'

notifications:
  email:
    enabled: true
    recipients:
      - 'example@example.com'
    from: 'example@example.com'
    smtp:
      host: 'smtp.example.com'
      port: 587
      secure: false
      usernameEnv: 'SMTP_USERNAME'
      passwordEnv: 'SMTP_PASSWORD'
      timeoutSeconds: 30
`;
    writeFileSync(configPath, source, 'utf8');

    const config: AppConfig = loadConfig(configPath);

    expect(config).toEqual({
      products: ['https://www.prisjakt.nu/produkt.php?p=13438192'],
      schedule: {
        cron: '0 7,19 * * *',
        timezone: 'Europe/Stockholm',
      },
      notifications: {
        email: {
          enabled: true,
          recipients: ['example@example.com'],
          from: 'example@example.com',
          smtp: {
            host: 'smtp.example.com',
            port: 587,
            secure: false,
            usernameEnv: 'SMTP_USERNAME',
            passwordEnv: 'SMTP_PASSWORD',
            timeoutSeconds: 30,
          },
        },
      },
    });
  });

  it('uses config.yaml in the current working directory by default', () => {
    const configPath = path.join(temporaryDirectory, 'config.yaml');
    writeFileSync(configPath, 'products: []\n', 'utf8');
    const cwdSpy = jest
      .spyOn(process, 'cwd')
      .mockReturnValue(temporaryDirectory);

    try {
      expect(getDefaultConfigPath()).toBe(configPath);
      expect(loadConfig()).toEqual({ products: [] });
    } finally {
      cwdSpy.mockRestore();
    }
  });

  it('rejects YAML documents without a mapping root', () => {
    const configPath = path.join(temporaryDirectory, 'invalid.yaml');
    writeFileSync(configPath, '- just a list\n', 'utf8');

    expect(() => loadConfig(configPath)).toThrow(
      'Configuration must contain a YAML mapping at its root',
    );
  });

  it('accepts a valid application configuration', () => {
    expect(() => validateConfig(createValidConfig())).not.toThrow();
  });

  it('rejects empty, malformed, and duplicate product URLs', () => {
    const emptyConfig = createValidConfig();
    emptyConfig.products = [];
    expect(() => validateConfig(emptyConfig)).toThrow(
      'products must contain at least one product URL',
    );

    const malformedConfig = createValidConfig();
    malformedConfig.products = ['https://example.com/product'];
    expect(() => validateConfig(malformedConfig)).toThrow(
      'products[0] must be a valid Prisjakt product URL',
    );

    const duplicateConfig = createValidConfig();
    duplicateConfig.products = [
      duplicateConfig.products[0],
      duplicateConfig.products[0],
    ];
    expect(() => validateConfig(duplicateConfig)).toThrow(
      'products[1] duplicates the product URL at products[0]',
    );
  });

  it('rejects invalid schedule and timezone settings', () => {
    const config = createValidConfig();
    config.schedule.cron = 'every morning';
    config.schedule.timezone = 'Not/A_Timezone';

    expect(() => validateConfig(config)).toThrow(
      'schedule.cron must be a valid five-field cron expression',
    );
    expect(() => validateConfig(config)).toThrow(
      'schedule.timezone is not a valid IANA timezone',
    );
  });

  it('rejects incomplete email settings when email is enabled', () => {
    const config = createValidConfig();
    config.notifications.email.recipients = [];
    config.notifications.email.from = '  ';
    config.notifications.email.smtp.host = '';
    config.notifications.email.smtp.port = 0;
    config.notifications.email.smtp.usernameEnv = 'SMTP-USERNAME';
    config.notifications.email.smtp.passwordEnv = '';
    config.notifications.email.smtp.timeoutSeconds = 0;

    expect(() => validateConfig(config)).toThrow(
      'notifications.email.recipients must contain at least one recipient',
    );
    expect(() => validateConfig(config)).toThrow(
      'notifications.email.from must be a non-empty sender',
    );
    expect(() => validateConfig(config)).toThrow(
      'notifications.email.smtp.host must be a valid host',
    );
    expect(() => validateConfig(config)).toThrow(
      'notifications.email.smtp.port must be an integer between 1 and 65535',
    );
    expect(() => validateConfig(config)).toThrow(
      'notifications.email.smtp.usernameEnv must be a valid environment variable name',
    );
    expect(() => validateConfig(config)).toThrow(
      'notifications.email.smtp.passwordEnv must be a valid environment variable name',
    );
    expect(() => validateConfig(config)).toThrow(
      'notifications.email.smtp.timeoutSeconds must be a positive number',
    );
  });

  it('does not require email details when email is disabled', () => {
    const config = createValidConfig();
    config.notifications.email.enabled = false;
    config.notifications.email.recipients = [];
    config.notifications.email.from = '';
    config.notifications.email.smtp.host = '';
    config.notifications.email.smtp.port = 0;

    expect(() => validateConfig(config)).not.toThrow();
  });
});

function createValidConfig(): AppConfig {
  return {
    products: ['https://www.prisjakt.nu/produkt.php?p=13438192'],
    schedule: {
      cron: '0 7,19 * * *',
      timezone: 'Europe/Stockholm',
    },
    notifications: {
      email: {
        enabled: true,
        recipients: ['example@example.com'],
        from: 'example@example.com',
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          usernameEnv: 'SMTP_USERNAME',
          passwordEnv: 'SMTP_PASSWORD',
          timeoutSeconds: 30,
        },
      },
    },
  };
}
