import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { AppConfig, getDefaultConfigPath, loadConfig } from '../src/config';

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
});
