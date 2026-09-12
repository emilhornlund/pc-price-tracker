import { closeDatabase, openDatabase } from '../src/database';
import { NotificationRepository } from '../src/notifications';
import { executeScan } from '../src/scanner';

describe('executeScan notifications', () => {
  it('sends exactly one consolidated email after all products finish', async () => {
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
    const result = await executeScan(productUrls, dependencies);

    expect(result.decreases).toHaveLength(2);
    expect(emailSender.send).toHaveBeenCalledTimes(1);
    expect(emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'PC Price Tracker — 2 price decreases',
      }),
    );
    const email = emailSender.send.mock.calls[0][0];
    expect(email.text).toContain('Product one');
    expect(email.text).toContain('Store two');
    expect(logger.info).toHaveBeenCalledWith('Email sent: 2 price decreases');

    closeDatabase(database);
  });

  it('does not send an email when a scan has no decreases', async () => {
    const database = openDatabase(':memory:');
    const emailSender = { send: jest.fn().mockResolvedValue(undefined) };
    const logger = { info: jest.fn(), error: jest.fn() };

    const result = await executeScan(
      ['https://www.prisjakt.nu/produkt.php?p=3'],
      {
        database,
        fetchPage: jest.fn().mockResolvedValue('<html>fixture</html>'),
        parsePage: jest.fn().mockReturnValue({
          title: 'Product',
          offers: [{ store: 'Store', storeId: 'store', price: 100 }],
        }),
        emailSender,
        logger,
      },
    );

    expect(result.emailSent).toBe(false);
    expect(emailSender.send).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'Email skipped: no price decreases',
    );

    closeDatabase(database);
  });

  it('keeps observations when SMTP delivery fails and records no notification', async () => {
    const database = openDatabase(':memory:');
    const productUrl = 'https://www.prisjakt.nu/produkt.php?p=4';
    const parsePage = jest
      .fn()
      .mockReturnValueOnce({
        title: 'Product',
        offers: [{ store: 'Store', storeId: 'store', price: 159_900 }],
      })
      .mockReturnValueOnce({
        title: 'Product',
        offers: [{ store: 'Store', storeId: 'store', price: 149_900 }],
      });
    const emailSender = {
      send: jest.fn().mockRejectedValue(new Error('SMTP unavailable')),
    };
    const logger = { info: jest.fn(), error: jest.fn() };
    const dependencies = {
      database,
      fetchPage: jest.fn().mockResolvedValue('<html>fixture</html>'),
      parsePage,
      emailSender,
      logger,
      notificationRepository: new NotificationRepository(database),
    };

    await executeScan([productUrl], dependencies);
    await expect(executeScan([productUrl], dependencies)).rejects.toThrow(
      'SMTP unavailable',
    );

    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM price_observations')
        .get(),
    ).toEqual({ count: 2 });
    expect(
      database.prepare('SELECT COUNT(*) AS count FROM notifications').get(),
    ).toEqual({ count: 0 });
    expect(logger.error).toHaveBeenCalledWith('Email failed: SMTP unavailable');

    closeDatabase(database);
  });

  it.each([
    ['unchanged prices', 159_900],
    ['price increases', 169_900],
  ])(
    'persists a new observation but sends no email for %s',
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
      const logger = { info: jest.fn(), error: jest.fn() };
      const dependencies = {
        database,
        fetchPage: jest.fn().mockResolvedValue('<html>fixture</html>'),
        parsePage,
        emailSender,
        logger,
      };

      const first = await executeScan(
        ['https://www.prisjakt.nu/produkt.php?p=5'],
        dependencies,
      );
      const second = await executeScan(
        ['https://www.prisjakt.nu/produkt.php?p=5'],
        dependencies,
      );

      expect(first.decreases).toEqual([]);
      expect(second.decreases).toEqual([]);
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
});
