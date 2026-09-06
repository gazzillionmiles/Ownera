import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logError } from '@/lib/logger';

const region = process.env.AWS_REGION || 'ap-south-1';

export const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export function getS3BucketName(): string {
  if (!process.env.S3_HISTORY_BUCKET_NAME) {
    throw new Error('S3_HISTORY_BUCKET_NAME environment variable is not defined.');
  }
  return process.env.S3_HISTORY_BUCKET_NAME;
}

/**
 * Extract real extension from mime type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mime = (mimeType || '').toLowerCase().trim();
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';

  const parts = mime.split('/');
  if (parts.length === 2 && parts[1]) {
    const sub = parts[1].toLowerCase();
    if (sub === 'jpeg') return 'jpg';
    return sub;
  }
  return 'jpg';
}

/**
 * Convert an original screenshot storage key to its thumbnail key
 * e.g. history/user1/gen1.png -> history/user1/gen1_thumb.jpg
 */
export function getThumbnailStoragePath(storagePath: string): string {
  return storagePath.replace(/(\.[^.]+)$/, '_thumb.jpg');
}

/**
 * Upload original screenshot directly to S3 via PutObjectCommand
 * and automatically generate + upload a small 200x200 JPEG thumbnail.
 * Key convention: history/{userId}/{generationId}.{ext}
 */
export async function uploadHistoryScreenshot({
  userId,
  generationId,
  mimeType,
  imageBuffer,
}: {
  userId: string;
  generationId: string;
  mimeType: string;
  imageBuffer: Buffer;
}): Promise<string> {
  const ext = getExtensionFromMimeType(mimeType);
  const key = `history/${userId}/${generationId}.${ext}`;
  const thumbKey = getThumbnailStoragePath(key);
  const bucket = getS3BucketName();

  // 1. Upload original high-res image
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: imageBuffer,
    ContentType: mimeType,
  });
  await s3Client.send(command);

  // 2. Synchronously generate and upload small 200x200 thumbnail
  try {
    const { default: sharp } = await import('sharp');
    const thumbBuffer = await sharp(imageBuffer)
      .resize({ width: 200, height: 200, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: thumbKey,
      Body: thumbBuffer,
      ContentType: 'image/jpeg',
    });
    await s3Client.send(thumbCommand);
  } catch (err) {
    logError('S3', 'thumbnailGenerationError', err, { userId, generationId }, 'Failed to generate thumbnail variant');
  }

  return key;
}

/**
 * Generate a presigned GET URL via S3RequestPresigner (getSignedUrl)
 * Default expiry: 300 seconds
 */
export async function getPresignedHistoryUrl(
  key: string,
  expiresInSeconds = 300
): Promise<string> {
  const bucket = getS3BucketName();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

/**
 * Delete a single S3 object (and its thumbnail) via DeleteObjectCommand
 */
export async function deleteS3Object(key: string, contextInfo?: Record<string, any>): Promise<boolean> {
  const bucket = getS3BucketName();
  const thumbKey = getThumbnailStoragePath(key);
  try {
    const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
    await s3Client.send(command);

    if (thumbKey !== key) {
      const thumbCommand = new DeleteObjectCommand({ Bucket: bucket, Key: thumbKey });
      await s3Client.send(thumbCommand).catch(() => {});
    }
    return true;
  } catch (err) {
    logError(
      'S3',
      'orphanedObject',
      err,
      { key, bucket, ...contextInfo },
      `Orphaned object error: Failed to delete S3 object key "${key}"`
    );
    return false;
  }
}

/**
 * Batch delete S3 objects via DeleteObjectsCommand (up to 1,000 keys per call)
 */
export async function deleteS3ObjectsBatch(
  keys: string[],
  contextInfo?: Record<string, any>
): Promise<{ deletedCount: number; failedKeys: string[] }> {
  if (!keys || keys.length === 0) {
    return { deletedCount: 0, failedKeys: [] };
  }

  // Include thumbnail keys alongside original keys
  const allKeysSet = new Set<string>();
  for (const k of keys) {
    allKeysSet.add(k);
    allKeysSet.add(getThumbnailStoragePath(k));
  }
  const allKeys = Array.from(allKeysSet);

  const bucket = getS3BucketName();
  const BATCH_SIZE = 1000;
  let deletedCount = 0;
  const failedKeys: string[] = [];

  for (let i = 0; i < allKeys.length; i += BATCH_SIZE) {
    const chunk = allKeys.slice(i, i + BATCH_SIZE);
    try {
      const command = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((key) => ({ Key: key })),
          Quiet: false,
        },
      });

      const result = await s3Client.send(command);
      if (result.Deleted) {
        deletedCount += result.Deleted.length;
      }

      if (result.Errors && result.Errors.length > 0) {
        for (const err of result.Errors) {
          if (err.Key) {
            failedKeys.push(err.Key);
            logError(
              'S3',
              'orphanedBatchObject',
              new Error(err.Message || 'DeleteObjectsCommand per-object error'),
              { key: err.Key, code: err.Code, bucket, ...contextInfo },
              `Orphaned object error: Batch deletion failed for key "${err.Key}"`
            );
          }
        }
      }
    } catch (err) {
      failedKeys.push(...chunk);
      logError(
        'S3',
        'orphanedBatchCommand',
        err,
        { chunkCount: chunk.length, bucket, ...contextInfo },
        `Orphaned object error: DeleteObjectsCommand chunk failed for ${chunk.length} keys`
      );
    }
  }

  return { deletedCount, failedKeys };
}

