import type { TrackerDatabase } from './database';

export type NotificationEventType = 'FIRST_OBSERVED' | 'PRICE_DECREASE';

interface NotificationEventIdentity {
  productId: number;
  storeId: string;
}

export interface FirstObservedNotificationInput extends NotificationEventIdentity {
  type: 'FIRST_OBSERVED';
  currentPrice: number;
}

export interface PriceDecreaseNotificationInput extends NotificationEventIdentity {
  type: 'PRICE_DECREASE';
  previousPrice: number;
  newPrice: number;
}

export type NotificationEventInput =
  FirstObservedNotificationInput | PriceDecreaseNotificationInput;

interface NotificationEventRecordBase extends NotificationEventIdentity {
  id: number;
  notificationId: number;
}

export interface FirstObservedNotificationRecord extends NotificationEventRecordBase {
  type: 'FIRST_OBSERVED';
  currentPrice: number;
}

export interface PriceDecreaseNotificationRecord extends NotificationEventRecordBase {
  type: 'PRICE_DECREASE';
  previousPrice: number;
  newPrice: number;
  decrease: number;
}

export type NotificationEventRecord =
  FirstObservedNotificationRecord | PriceDecreaseNotificationRecord;

export interface NotificationRecord {
  id: number;
  sentAt: string;
  events: NotificationEventRecord[];
}

interface NotificationRow {
  id: number;
  sent_at: string;
}

interface NotificationEventRow {
  id: number;
  notification_id: number;
  product_id: number;
  store_id: string;
  event_type: NotificationEventType;
  previous_price: number | null;
  new_price: number;
  decrease: number | null;
}

export class NotificationRepository {
  public constructor(private readonly database: TrackerDatabase) {}

  public createSentNotification(
    events: readonly NotificationEventInput[],
    sentAt = new Date().toISOString(),
  ): NotificationRecord {
    if (events.length === 0) {
      throw new Error('A notification must contain at least one price event');
    }

    const create = this.database.transaction(() => {
      const notificationResult = this.database
        .prepare('INSERT INTO notifications (sent_at) VALUES (?)')
        .run(sentAt);
      const notificationId = Number(notificationResult.lastInsertRowid);
      const insertEvent = this.database.prepare(
        `
          INSERT INTO notification_changes
            (notification_id, product_id, store_id, event_type,
             previous_price, new_price, decrease)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      );

      for (const event of events) {
        validateEvent(event);
        insertEvent.run(
          notificationId,
          event.productId,
          event.storeId,
          event.type,
          event.type === 'FIRST_OBSERVED' ? null : event.previousPrice,
          event.type === 'FIRST_OBSERVED' ? event.currentPrice : event.newPrice,
          event.type === 'FIRST_OBSERVED'
            ? null
            : event.previousPrice - event.newPrice,
        );
      }

      return notificationId;
    });

    return this.findById(create())!;
  }

  public findById(id: number): NotificationRecord | undefined {
    const notification = this.database
      .prepare('SELECT * FROM notifications WHERE id = ?')
      .get(id) as NotificationRow | undefined;
    if (notification === undefined) {
      return undefined;
    }

    const events = this.database
      .prepare(
        `
          SELECT * FROM notification_changes
          WHERE notification_id = ?
          ORDER BY id ASC
        `,
      )
      .all(id) as NotificationEventRow[];

    return {
      id: notification.id,
      sentAt: notification.sent_at,
      events: events.map(mapEventRow),
    };
  }
}

export const recordSentNotification = (
  repository: NotificationRepository,
  events: readonly NotificationEventInput[],
  sentAt?: string,
): NotificationRecord => repository.createSentNotification(events, sentAt);

function validateEvent(event: NotificationEventInput): void {
  if (event.type === 'FIRST_OBSERVED') {
    validatePrice(event.currentPrice, 'current price');
    return;
  }

  validatePrice(event.previousPrice, 'previous price');
  validatePrice(event.newPrice, 'new price');
  if (event.previousPrice <= event.newPrice) {
    throw new Error(
      'Price decrease notifications must contain a positive price decrease',
    );
  }
}

function validatePrice(price: number, label: string): void {
  if (!Number.isSafeInteger(price) || price < 0) {
    throw new Error(`${label} must be a non-negative integer in öre`);
  }
}

function mapEventRow(row: NotificationEventRow): NotificationEventRecord {
  const identity = {
    id: row.id,
    notificationId: row.notification_id,
    productId: row.product_id,
    storeId: row.store_id,
  };

  if (row.event_type === 'FIRST_OBSERVED') {
    return {
      ...identity,
      type: 'FIRST_OBSERVED',
      currentPrice: row.new_price,
    };
  }

  if (row.previous_price === null || row.decrease === null) {
    throw new Error(`Notification event ${row.id} is missing decrease data`);
  }

  return {
    ...identity,
    type: 'PRICE_DECREASE',
    previousPrice: row.previous_price,
    newPrice: row.new_price,
    decrease: row.decrease,
  };
}
