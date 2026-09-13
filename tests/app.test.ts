import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createApplication } from '../src/app';

describe('createApplication', () => {
  it('loads validated configuration and initializes the database', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'pc-price-tracker-'));
    const configPath = path.join(directory, 'config.yaml');
    writeFileSync(
      configPath,
      `products:
  - https://www.prisjakt.nu/produkt.php?p=1
schedule:
  cron: '* * * * *'
  timezone: UTC
notifications:
  email:
    enabled: false
`,
    );

    const logger = { info: jest.fn(), error: jest.fn() };
    const application = createApplication(configPath, {
      databasePath: ':memory:',
      logger,
    });

    expect(application.config.products).toEqual([
      'https://www.prisjakt.nu/produkt.php?p=1',
    ]);
    expect(application.database.open).toBe(true);
    expect(logger.info).toHaveBeenCalledWith('PC Price Tracker starting');
    expect(logger.info).toHaveBeenCalledWith('Configuration loaded');
    expect(logger.info).toHaveBeenCalledWith('Database initialized');
    expect(logger.info).toHaveBeenCalledWith('Email notifications disabled');

    application.startScheduled();
    expect(logger.info).toHaveBeenCalledWith(
      'Scheduler initialized: * * * * *',
    );
    expect(logger.info).toHaveBeenCalledWith('Scheduler timezone: UTC');

    application.close();
    expect(application.database.open).toBe(false);
    expect(logger.info).toHaveBeenCalledWith(
      'Scheduler stopped during shutdown',
    );
    expect(logger.info).toHaveBeenCalledWith('Database closed during shutdown');
    expect(logger.info).toHaveBeenCalledWith('Graceful shutdown completed');
    rmSync(directory, { recursive: true, force: true });
  });
});
