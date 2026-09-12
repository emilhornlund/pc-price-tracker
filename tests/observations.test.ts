import { closeDatabase, openDatabase } from '../src/database';
import { PriceObservationRepository } from '../src/observations';
import { ProductRepository } from '../src/products';
import { StoreRepository } from '../src/stores';

describe('PriceObservationRepository', () => {
  it('stores historical observations using product and store ids', () => {
    const database = openDatabase(':memory:');
    const products = new ProductRepository(database);
    const stores = new StoreRepository(database);
    const observations = new PriceObservationRepository(database);
    const product = products.create('https://www.prisjakt.nu/produkt.php?p=1');
    const store = stores.create('store-1', 'Example store');

    const first = observations.create(
      product.id,
      store.id,
      159_900,
      '2026-09-12T07:00:00.000Z',
    );
    const second = observations.create(
      product.id,
      store.id,
      149_900,
      '2026-09-12T19:00:00.000Z',
    );

    expect(observations.findLatest(product.id, store.id)).toEqual(second);
    expect(observations.findForProductStore(product.id, store.id)).toEqual([
      first,
      second,
    ]);

    const columns = database
      .prepare('PRAGMA table_info(price_observations)')
      .all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).not.toContain('store');
    expect(columns.map((column) => column.name)).toContain('store_id');

    closeDatabase(database);
  });

  it('rejects observations that do not reference existing records', () => {
    const database = openDatabase(':memory:');
    const observations = new PriceObservationRepository(database);

    expect(() => observations.create(999, 'missing-store', 100)).toThrow();

    closeDatabase(database);
  });
});
