import { closeDatabase, openDatabase } from '../src/database';
import { ProductRepository } from '../src/products';

describe('ProductRepository', () => {
  it('creates products and reuses the unique URL', () => {
    const database = openDatabase(':memory:');
    const products = new ProductRepository(database);

    const created = products.create(
      'https://www.prisjakt.nu/produkt.php?p=13438192',
      'First title',
    );
    const found = products.findByUrl(created.url);

    expect(found).toEqual(created);
    expect(() => products.create(created.url, 'Duplicate')).toThrow();

    closeDatabase(database);
  });

  it('updates a scraped title without changing the product identity', () => {
    const database = openDatabase(':memory:');
    const products = new ProductRepository(database);
    const created = products.create('https://www.prisjakt.nu/produkt.php?p=1');

    const updated = products.updateTitle(created.id, 'Scraped title');

    expect(updated.id).toBe(created.id);
    expect(updated.url).toBe(created.url);
    expect(updated.title).toBe('Scraped title');
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).not.toBe(created.updatedAt);

    closeDatabase(database);
  });
});
