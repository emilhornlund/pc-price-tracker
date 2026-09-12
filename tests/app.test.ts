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

    const application = createApplication(configPath, {
      databasePath: ':memory:',
      logger: { info: jest.fn(), error: jest.fn() },
    });

    expect(application.config.products).toEqual([
      'https://www.prisjakt.nu/produkt.php?p=1',
    ]);
    expect(application.database.open).toBe(true);
    application.close();
    expect(application.database.open).toBe(false);
    rmSync(directory, { recursive: true, force: true });
  });
});
