import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Application } from '../src/app';

jest.mock('../src/app', () => ({
  createApplication: jest.fn(),
}));

describe('main', () => {
  it('identifies a one-off scan when manual mode is selected', async () => {
    const { main } = await importMain();
    const { createApplication } = await import('../src/app');
    const application = {
      runScan: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
    } as unknown as Application;
    const logger = { info: jest.fn(), error: jest.fn() };
    jest.mocked(createApplication).mockReturnValue(application);

    await main(['--scan'], logger);

    expect(logger.info).toHaveBeenCalledWith('Manual scan mode starting');
    expect(application.runScan).toHaveBeenCalledTimes(1);
    expect(application.close).toHaveBeenCalledTimes(1);
  });

  it('loads local dotenv values before startup', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'pc-price-tracker-'));
    const originalCwd = process.cwd();
    const originalEnvironment = saveSmtpEnvironment();
    writeFileSync(
      path.join(directory, '.env'),
      'SMTP_USERNAME=dotenv-user\nSMTP_PASSWORD=dotenv-password\n',
    );

    try {
      delete process.env.SMTP_USERNAME;
      delete process.env.SMTP_PASSWORD;
      process.chdir(directory);

      await importMain();

      expect(process.env.SMTP_USERNAME).toBe('dotenv-user');
      expect(process.env.SMTP_PASSWORD).toBe('dotenv-password');
    } finally {
      restoreSmtpEnvironment(originalEnvironment);
      process.chdir(originalCwd);
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not override explicitly supplied environment values', async () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'pc-price-tracker-'));
    const originalCwd = process.cwd();
    const originalEnvironment = saveSmtpEnvironment();
    writeFileSync(
      path.join(directory, '.env'),
      'SMTP_USERNAME=dotenv-user\nSMTP_PASSWORD=dotenv-password\n',
    );

    try {
      process.env.SMTP_USERNAME = 'external-user';
      process.env.SMTP_PASSWORD = 'external-password';
      process.chdir(directory);

      await importMain();

      expect(process.env.SMTP_USERNAME).toBe('external-user');
      expect(process.env.SMTP_PASSWORD).toBe('external-password');
    } finally {
      restoreSmtpEnvironment(originalEnvironment);
      process.chdir(originalCwd);
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

async function importMain(): Promise<typeof import('../src/main')> {
  jest.resetModules();
  return import('../src/main');
}

function saveSmtpEnvironment(): {
  username: string | undefined;
  password: string | undefined;
} {
  return {
    username: process.env.SMTP_USERNAME,
    password: process.env.SMTP_PASSWORD,
  };
}

function restoreSmtpEnvironment(environment: {
  username: string | undefined;
  password: string | undefined;
}): void {
  if (environment.username === undefined) {
    delete process.env.SMTP_USERNAME;
  } else {
    process.env.SMTP_USERNAME = environment.username;
  }

  if (environment.password === undefined) {
    delete process.env.SMTP_PASSWORD;
  } else {
    process.env.SMTP_PASSWORD = environment.password;
  }
}
