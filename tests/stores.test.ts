import { closeDatabase, openDatabase } from '../src/database';
import { StoreRepository } from '../src/stores';

describe('StoreRepository', () => {
  it('allows distinct store ids to share a display name', () => {
    const database = openDatabase(':memory:');
    const stores = new StoreRepository(database);

    const first = stores.create('store-1', 'Same name');
    const second = stores.create('store-2', 'Same name');

    expect(first.id).not.toBe(second.id);
    expect(first.name).toBe(second.name);
    expect(
      database.prepare('SELECT COUNT(*) AS count FROM stores').get(),
    ).toEqual({ count: 2 });

    closeDatabase(database);
  });

  it('reuses a store id and updates its displayed name', () => {
    const database = openDatabase(':memory:');
    const stores = new StoreRepository(database);
    const created = stores.create('store-1', 'Original name');

    const found = stores.findOrCreate('store-1', 'Current name');

    expect(found.id).toBe(created.id);
    expect(found.name).toBe('Current name');
    expect(found.createdAt).toBe(created.createdAt);
    expect(found.updatedAt).not.toBe(created.updatedAt);

    closeDatabase(database);
  });
});
