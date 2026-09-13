import { closeDatabase, openDatabase } from '../src/database';
import { NotificationRepository } from '../src/notifications';
import { executeScan } from '../src/scanner';

describe('executeScan notifications', () => {
  it('sends one consolidated email containing every first-observed offer', async () => {
    const database = openDatabase(':memory:');
    const emailSender = { send: jest.fn().mockResolvedValue(undefined) };
    const result = await executeScan(
      ['https://www.prisjakt.nu/produkt.php?p=1'],
      {
        database,
        fetchPage: jest.fn().mockResolvedValue('<html>fixture</html>'),
        parsePage: jest.fn().mockReturnValue({
          title: 'Product',
          offers: [
            { store: 'Store one', storeId: 'store-1', price: 159_900 },
            { store: 'Store two', storeId: 'store-2', price: 149_900 },
          ],
        }),
        emailSender,
        notificationRepository: new NotificationRepository(database),
      },
    );

    expect(result.priceEvents).toEqual([
      {
        type: 'FIRST_OBSERVED',
        product: 'Product',
        store: 'Store one',
        currentPrice: 159_900,
      },
      {
        type: 'FIRST_OBSERVED',
        product: 'Product',
        store: 'Store two',
        currentPrice: 149_900,
      },
    ]);
    expect(emailSender.send).toHaveBeenCalledTimes(1);
    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'PC Price Tracker — 2 first observations',
      }),
    );
    const email = emailSender.send.mock.calls[0][0];
    expect(email.text).toContain('Store one');
    expect(email.text).toContain('Store two');
    expect(email.text).toContain('Current price: 1 599 SEK');
    expect(email.text).toContain('Current price: 1 499 SEK');
    expect(email.text).toContain('Status: First observed');
    expect(result.notification?.events).toHaveLength(2);
    expect(result.notification?.events[0]).toMatchObject({
      type: 'FIRST_OBSERVED',
      currentPrice: 159_900,
    });

    closeDatabase(database);
  });

  it('sends exactly one consolidated email for decreases after all products finish', async () => {
    const database = openDatabase(':memory:');
    const productUrls = [
      'https://www.prisjakt.nu/produkt.php?p=1',
      'https://www.prisjakt.nu/produkt.php?p=2',
    ];
    const parsePage = jest
      .fn()
      .mockReturnValueOnce({
        title: 'Product one',
        offers: [{ store: 'Store one', storeId: 'store-1', price: 159_900 }],
      })
      .mockReturnValueOnce({
        title: 'Product two',
        offers: [{ store: 'Store two', storeId: 'store-2', price: 259_900 }],
      })
      .mockReturnValueOnce({
        title: 'Product one',
        offers: [{ store: 'Store one', storeId: 'store-1', price: 149_900 }],
      })
      .mockReturnValueOnce({
        title: 'Product two',
        offers: [{ store: 'Store two', storeId: 'store-2', price: 239_900 }],
      });
    const emailSender = { send: jest.fn().mockResolvedValue(undefined) };
    const logger = { info: jest.fn(), error: jest.fn() };
    const dependencies = {
      database,
      fetchPage: jest.fn().mockResolvedValue('<html>fixture</html>'),
      parsePage,
      emailSender,
      logger,
    };

    await executeScan(productUrls, dependencies);
    emailSender.send.mockClear();
    const result = await executeScan(productUrls, dependencies);

    expect(result.priceEvents).toEqual([
      {
        type: 'PRICE_DECREASE',
        product: 'Product one',
        store: 'Store one',
        previousPrice: 159_900,
        newPrice: 149_900,
        decrease: 10_000,
      },
      {
        type: 'PRICE_DECREASE',
        product: 'Product two',
        store: 'Store two',
        previousPrice: 259_900,
        newPrice: 239_900,
        decrease: 20_000,
      },
    ]);
    expect(emailSender.send).toHaveBeenCalledTimes(1);
    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'PC Price Tracker — 2 price decreases',
      }),
    );
    const email = emailSender.send.mock.calls[0][0];
    expect(email.text).toContain('Previous price: 1 599 SEK');
    expect(email.text).toContain('New price: 1 499 SEK');
    expect(email.text).toContain('Store two');
    expect(logger.info).toHaveBeenCalledWith('Email sent: 2 price events');

    closeDatabase(database);
  });

  it.each([
    ['unchanged prices', 159_900],
    ['price increases', 169_900],
  ])(
    'persists a new observation but sends no email for %s after its baseline',
    async (_description, currentPrice) => {
      const database = openDatabase(':memory:');
      const parsePage = jest
        .fn()
        .mockReturnValueOnce({
          title: 'Product',
          offers: [{ store: 'Store', storeId: 'store', price: 159_900 }],
        })
        .mockReturnValueOnce({
          title: 'Product',
          offers: [{ store: 'Store', storeId: 'store', price: currentPrice }],
        });
      const emailSender = { send: jest.fn().mockResolvedValue(undefined) };
      const dependencies = {
        database,
        fetchPage: jest.fn().mockResolvedValue('<html>fixture</html>'),
        parsePage,
        emailSender,
      };

      const first = await executeScan(
        ['https://www.prisjakt.nu/produkt.php?p=5'],
        dependencies,
      );
      emailSender.send.mockClear();
      const second = await executeScan(
        ['https://www.prisjakt.nu/produkt.php?p=5'],
        dependencies,
      );

      expect(first.priceEvents).toHaveLength(1);
      expect(second.priceEvents).toEqual([]);
      expect(second.emailSent).toBe(false);
      expect(emailSender.send).not.toHaveBeenCalled();
      expect(
        database
          .prepare('SELECT COUNT(*) AS count FROM price_observations')
          .get(),
      ).toEqual({ count: 2 });

      closeDatabase(database);
    },
  );

  it('sends one email containing first observations and decreases together', async () => {
    const database = openDatabase(':memory:');
    const productUrls = [
      'https://www.prisjakt.nu/produkt.php?p=1',
      'https://www.prisjakt.nu/produkt.php?p=2',
    ];
    const parsePage = jest
      .fn()
      .mockReturnValueOnce({
        title: 'Tracked product',
        offers: [
          { store: 'Existing store', storeId: 'store-1', price: 159_900 },
        ],
      })
      .mockReturnValueOnce({
        title: 'Tracked product two',
        offers: [
          { store: 'Existing store two', storeId: 'store-2', price: 259_900 },
        ],
      })
      .mockReturnValueOnce({
        title: 'Tracked product',
        offers: [
          { store: 'Existing store', storeId: 'store-1', price: 149_900 },
        ],
      })
      .mockReturnValueOnce({
        title: 'Tracked product two',
        offers: [
          { store: 'Existing store two', storeId: 'store-2', price: 259_900 },
          { store: 'New store', storeId: 'store-3', price: 129_900 },
        ],
      });
    const emailSender = { send: jest.fn().mockResolvedValue(undefined) };
    const dependencies = {
      database,
      fetchPage: jest.fn().mockResolvedValue('<html>fixture</html>'),
      parsePage,
      emailSender,
    };

    await executeScan(productUrls, dependencies);
    emailSender.send.mockClear();
    const result = await executeScan(productUrls, dependencies);

    expect(result.priceEvents).toEqual([
      {
        type: 'PRICE_DECREASE',
        product: 'Tracked product',
        store: 'Existing store',
        previousPrice: 159_900,
        newPrice: 149_900,
        decrease: 10_000,
      },
      {
        type: 'FIRST_OBSERVED',
        product: 'Tracked product two',
        store: 'New store',
        currentPrice: 129_900,
      },
    ]);
    expect(emailSender.send).toHaveBeenCalledTimes(1);
    const email = emailSender.send.mock.calls[0][0];
    expect(email.subject).toBe('PC Price Tracker — 2 price notifications');
    expect(email.text).toContain('Status: First observed');
    expect(email.text).toContain('Previous price: 1 599 SEK');
    expect(email.text).toContain('Decrease: 100 SEK');

    closeDatabase(database);
  });

  it('keeps observations when SMTP delivery fails and records no notification', async () => {
    const database = openDatabase(':memory:');
    const emailSender = {
      send: jest.fn().mockRejectedValue(new Error('SMTP unavailable')),
    };
    const logger = { info: jest.fn(), error: jest.fn() };

    await expect(
      executeScan(['https://www.prisjakt.nu/produkt.php?p=4'], {
        database,
        fetchPage: jest.fn().mockResolvedValue('<html>fixture</html>'),
        parsePage: jest.fn().mockReturnValue({
          title: 'Product',
          offers: [{ store: 'Store', storeId: 'store', price: 159_900 }],
        }),
        emailSender,
        logger,
        notificationRepository: new NotificationRepository(database),
      }),
    ).rejects.toThrow('SMTP unavailable');

    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM price_observations')
        .get(),
    ).toEqual({ count: 1 });
    expect(
      database.prepare('SELECT COUNT(*) AS count FROM notifications').get(),
    ).toEqual({ count: 0 });
    expect(logger.error).toHaveBeenCalledWith('Email failed: SMTP unavailable');

    closeDatabase(database);
  });
});
