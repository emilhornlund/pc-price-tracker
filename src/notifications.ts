import type { TrackerDatabase } from './database';

export interface NotificationChangeInput {
  productId: number;
  storeId: string;
  previousPrice: number;
  newPrice: number;
}

export interface NotificationChangeRecord extends NotificationChangeInput {
  id: number;
  notificationId: number;
  decrease: number;
}

export interface NotificationRecord {
  id: number;
  sentAt: string;
  changes: NotificationChangeRecord[];
}

interface NotificationRow {
  id: number;
  sent_at: string;
}

interface NotificationChangeRow {
  id: number;
  notification_id: number;
  product_id: number;
  store_id: string;
  previous_price: number;
  new_price: number;
  decrease: number;
}

export class NotificationRepository {
  public constructor(private readonly database: TrackerDatabase) {}

  public createSentNotification(
    changes: readonly NotificationChangeInput[],
    sentAt = new Date().toISOString(),
  ): NotificationRecord {
    if (changes.length === 0) {
      throw new Error('A notification must contain at least one price change');
    }

    const create = this.database.transaction(() => {
      const notificationResult = this.database
        .prepare('INSERT INTO notifications (sent_at) VALUES (?)')
        .run(sentAt);
      const notificationId = Number(notificationResult.lastInsertRowid);
      const insertChange = this.database.prepare(
        `
          INSERT INTO notification_changes
            (notification_id, product_id, store_id, previous_price, new_price, decrease)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      );

      for (const change of changes) {
        validateChange(change);
        insertChange.run(
          notificationId,
          change.productId,
          change.storeId,
          change.previousPrice,
          change.newPrice,
          change.previousPrice - change.newPrice,
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

    const changes = this.database
      .prepare(
        `
          SELECT * FROM notification_changes
          WHERE notification_id = ?
          ORDER BY id ASC
        `,
      )
      .all(id) as NotificationChangeRow[];

    return {
      id: notification.id,
      sentAt: notification.sent_at,
      changes: changes.map(mapChangeRow),
    };
  }
}

export const recordSentNotification = (
  repository: NotificationRepository,
  changes: readonly NotificationChangeInput[],
  sentAt?: string,
): NotificationRecord => repository.createSentNotification(changes, sentAt);

function validateChange(change: NotificationChangeInput): void {
  if (
    !Number.isSafeInteger(change.previousPrice) ||
    !Number.isSafeInteger(change.newPrice) ||
    change.previousPrice <= change.newPrice ||
    change.previousPrice < 0 ||
    change.newPrice < 0
  ) {
    throw new Error(
      'Notification changes must contain a positive price decrease',
    );
  }
}

function mapChangeRow(row: NotificationChangeRow): NotificationChangeRecord {
  return {
    id: row.id,
    notificationId: row.notification_id,
    productId: row.product_id,
    storeId: row.store_id,
    previousPrice: row.previous_price,
    newPrice: row.new_price,
    decrease: row.decrease,
  };
}
