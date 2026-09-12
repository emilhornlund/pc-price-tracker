import { closeDatabase, openDatabase } from '../src/database';
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
});
