import { startConsumer } from '@taqeem/shared/events/consumer.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function startSocialConsumers() {
  await startConsumer({
    queue: 'social.users.queue',
    bindings: ['user.registered'],
    handler: async (payload, headers) => {
      const type = headers['x-event-type'];
      if (type === 'user.registered') {
        const userId = payload.userId;
        const defaultLists = [
          { systemKey: 'SAVED', title: 'Saved' },
          { systemKey: 'WANT', title: 'Want to Go' },
          { systemKey: 'BEEN', title: 'Been to' }
        ];

        for (const list of defaultLists) {
          // Idempotent creation
          const existing = await prisma.collection.findUnique({
            where: { ownerId_systemKey: { ownerId: userId, systemKey: list.systemKey } }
          });
          if (!existing) {
            await prisma.collection.create({
              data: {
                ownerId: userId,
                systemKey: list.systemKey,
                title: list.title,
                slug: `${userId}-${list.systemKey}`.toLowerCase(),
                type: 'USER_LIST',
                visibility: 'PRIVATE'
              }
            });
          }
        }
      }
    }
  });

  await startConsumer({
    queue: 'social.visits.queue',
    bindings: ['reservation.completed', 'order.completed', 'checkin.created'],
    handler: async (payload, headers) => {
      const type = headers['x-event-type'];
      const map: Record<string, [string, string]> = {
        'reservation.completed': ['userId', 'businessId'],
        'order.completed':       ['userId', 'businessId'],
        'checkin.created':       ['userId', 'businessId'],
      };
      
      const keys = map[type as string];
      if (!keys) return;

      const userId = payload[keys[0]];
      const businessId = payload[keys[1]];

      if (!userId || !businessId) return;

      const beenList = await prisma.collection.findUnique({ 
        where: { ownerId_systemKey: { ownerId: userId, systemKey: 'BEEN' } } 
      });
      
      if (!beenList) return;

      await prisma.collectionItem.upsert({
        where: { collectionId_businessId: { collectionId: beenList.id, businessId } },
        create: { collectionId: beenList.id, businessId, addedById: userId },
        update: {},
      });
    }
  });
}
