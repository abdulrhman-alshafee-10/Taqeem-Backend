import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { PassThrough } from 'stream';

const prisma = new PrismaClient();
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Highly robust streaming export to S3 using AWS SDK lib-storage (Multipart Upload).
 * We export decisions related to REVIEWS to NDJSON format.
 */
export async function exportFakeDetectionLabels() {
  console.log('[S3 Export] Starting nightly fake detection label export...');
  const bucket = process.env.S3_BACKUP_BUCKET || 'taqeem-fake-detection-labels';
  const dateStr = new Date().toISOString().split('T')[0];
  const key = `exports/${dateStr}/review-labels.ndjson`;

  // Create a PassThrough stream
  const passThrough = new PassThrough();

  // Initialize the multipart upload to S3
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      Body: passThrough,
      ContentType: 'application/x-ndjson',
    },
  });

  // Start the upload asynchronously
  const uploadPromise = upload.done();

  try {
    let cursor: string | undefined = undefined;
    const batchSize = 1000;
    let hasMore = true;
    let totalExported = 0;

    // Use keyset pagination (cursor) to handle millions of rows without memory bloat
    while (hasMore) {
      const actions = await prisma.modAction.findMany({
        where: {
          queueEntry: {
            contentKind: 'REVIEW'
          }
        },
        take: batchSize,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: 'asc' },
        include: {
          queueEntry: true
        }
      });

      if (actions.length === 0) {
        hasMore = false;
        break;
      }

      for (const action of actions) {
        // Construct the row for the ML dataset
        const row = {
          review_id: action.queueEntry.contentId,
          score: action.queueEntry.aiScore,
          decision: action.action,
          signals: action.queueEntry.aiSignals,
          moderator_id: action.moderatorId,
          decided_at: action.createdAt.toISOString(),
          author_id: action.queueEntry.authorId,
        };
        // Write as NDJSON (Newline Delimited JSON)
        passThrough.write(JSON.stringify(row) + '\n');
        totalExported++;
      }

      cursor = actions[actions.length - 1].id;
    }

    // End the stream and wait for the upload to complete
    passThrough.end();
    await uploadPromise;
    console.log(`[S3 Export] Successfully exported ${totalExported} labels to s3://${bucket}/${key}`);
  } catch (err) {
    console.error('[S3 Export] Failed during export:', err);
    passThrough.destroy(err as Error);
    throw err;
  }
}

// Schedule to run at 2:00 AM every night
cron.schedule('0 2 * * *', () => {
  exportFakeDetectionLabels().catch(console.error);
});
