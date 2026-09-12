import { closeDatabase, openDatabase } from '../src/database';
import { NotificationRepository } from '../src/notifications';
import { ProductRepository } from '../src/products';
import { StoreRepository } from '../src/stores';

describe('NotificationRepository', () => {
  it('records a sent notification and every associated price change', () => {
    const database = openDatabase(':memory:');
    const products = new ProductRepository(database);
    const stores = new StoreRepository(database);
    const notifications = new NotificationRepository(database);
    const product = products.create('https://www.prisjakt.nu/produkt.php?p=1');
    const store = stores.create('store-1', 'Example store');

    const notification = notifications.createSentNotification(
      [
        {
          productId: product.id,
          storeId: store.id,
          previousPrice: 159_900,
          newPrice: 149_900,
        },
      ],
      '2026-09-12T19:00:00.000Z',
    );

    expect(notification).toEqual({
      id: notification.id,
      sentAt: '2026-09-12T19:00:00.000Z',
      changes: [
        {
          id: notification.changes[0].id,
          notificationId: notification.id,
          productId: product.id,
          storeId: store.id,
          previousPrice: 159_900,
          newPrice: 149_900,
          decrease: 10_000,
        },
      ],
    });
    expect(notifications.findById(notification.id)).toEqual(notification);

    const columns = database
      .prepare('PRAGMA table_info(notification_changes)')
      .all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).not.toContain('store');

    closeDatabase(database);
  });

  it('does not create an empty notification', () => {
    const database = openDatabase(':memory:');
    const notifications = new NotificationRepository(database);

    expect(() => notifications.createSentNotification([])).toThrow(
      'at least one price change',
    );

    closeDatabase(database);
  });
});
