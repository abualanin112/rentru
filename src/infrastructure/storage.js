import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from './config.js';
import { logger } from './logger.js';

// Initialize the S3 client for Cloudflare R2
const storageClient = new S3Client({
  region: 'auto',
  endpoint: `https://${config.cloudflare.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.cloudflare.accessKeyId,
    secretAccessKey: config.cloudflare.secretAccessKey,
  },
});

/**
 * Upload an object to Cloudflare R2
 * @param {string} bucketName
 * @param {string} key
 * @param {Buffer|string} body
 * @param {string} contentType
 * @returns {Promise<import('@aws-sdk/client-s3').PutObjectCommandOutput>}
 */
export const uploadToR2 = async (bucketName, key, body, contentType) => {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  try {
    return await storageClient.send(command);
  } catch (error) {
    logger.error({ err: error, bucketName, key }, 'Failed to upload object to Cloudflare R2');
    throw error;
  }
};

export { storageClient };
