import { closeDatabase, openDatabase } from '../src/database';
import { scanProduct } from '../src/scanner';

describe('scanProduct', () => {
  it('fetches, parses, and persists one product with every offer', async () => {
    const database = openDatabase(':memory:');
    const productUrl = 'https://www.prisjakt.nu/produkt.php?p=13438192';
    const fetchPage = jest.fn().mockResolvedValue('<html>fixture</html>');
    const parsePage = jest.fn().mockReturnValue({
      title: 'Example product',
      offers: [
        { store: 'Same name', storeId: 'store-1', price: 159_900 },
        { store: 'Same name', storeId: 'store-2', price: 149_900 },
      ],
    });

    const result = await scanProduct(productUrl, {
      database,
      fetchPage,
      parsePage,
    });

    expect(fetchPage).toHaveBeenCalledWith(productUrl);
    expect(parsePage).toHaveBeenCalledWith('<html>fixture</html>');
    expect(result.product.title).toBe('Example product');
    expect(result.offers.map(({ store }) => store.id)).toEqual([
      'store-1',
      'store-2',
    ]);
    expect(
      database.prepare('SELECT COUNT(*) AS count FROM products').get(),
    ).toEqual({ count: 1 });
    expect(
      database.prepare('SELECT COUNT(*) AS count FROM stores').get(),
    ).toEqual({ count: 2 });
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM price_observations')
        .get(),
    ).toEqual({ count: 2 });

    closeDatabase(database);
  });

  it('reuses the product and stores while retaining observations on repeat scans', async () => {
    const database = openDatabase(':memory:');
    const parsed = {
      title: 'Example product',
      offers: [{ store: 'Example store', storeId: 'store-1', price: 149_900 }],
    };
    const dependencies = {
      database,
      fetchPage: jest.fn().mockResolvedValue('<html>fixture</html>'),
      parsePage: jest.fn().mockReturnValue(parsed),
    };

    const first = await scanProduct(
      'https://www.prisjakt.nu/produkt.php?p=1',
      dependencies,
    );
    const second = await scanProduct(
      'https://www.prisjakt.nu/produkt.php?p=1',
      dependencies,
    );

    expect(second.product.id).toBe(first.product.id);
    expect(second.offers[0].store.id).toBe(first.offers[0].store.id);
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM price_observations')
        .get(),
    ).toEqual({ count: 2 });

    closeDatabase(database);
  });
});
