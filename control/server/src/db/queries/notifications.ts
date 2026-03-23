import { eq } from 'drizzle-orm'
import { db } from '../index.js'
import { notifications, type Notification, type NewNotification } from '../schema.js'

export async function findAllNotifications(): Promise<Notification[]> {
  return db.select().from(notifications).orderBy(notifications.sentAt)
}

export async function createNotification(data: NewNotification): Promise<Notification> {
  const rows = await db.insert(notifications).values(data).returning()
  const row = rows[0]
  if (!row) throw new Error('Failed to create notification')
  return row
}

export async function updateNotificationStatus(
  id: string,
  status: Notification['status'],
  error?: string,
): Promise<void> {
  await db
    .update(notifications)
    .set({ status, error: error ?? null, sentAt: new Date() })
    .where(eq(notifications.id, id))
}
