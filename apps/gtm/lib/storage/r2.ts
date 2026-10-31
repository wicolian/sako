/**
 * Cloudflare R2 Storage Client
 * 
 * S3-compatible object storage for:
 * - Generated images
 * - Exported assets
 * - User uploads
 * 
 * Uses AWS SDK v3 for S3 compatibility
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// =============================================================================
// Configuration
// =============================================================================

const R2_ENDPOINT = process.env.R2_S3_ENDPOINT;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'sako-composer';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_BASE_URL || 'https://assetscomposer.trysako.com';

/**
 * Create R2 client (S3-compatible)
 */
function createR2Client(): S3Client {
  if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
    throw new Error(
      'R2 configuration missing. Set these in .env.local:\n' +
      '  R2_S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com\n' +
      '  R2_ACCESS_KEY_ID=your_access_key\n' +
      '  R2_SECRET_ACCESS_KEY=your_secret_key'
    );
  }

  return new S3Client({
    region: 'auto', // R2 uses 'auto' for region
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY,
      secretAccessKey: R2_SECRET_KEY,
    },
  });
}

// Lazy-initialize client
let r2Client: S3Client | null = null;

function getClient(): S3Client {
  if (!r2Client) {
    r2Client = createR2Client();
  }
  return r2Client;
}

// =============================================================================
// Upload Functions
// =============================================================================

export interface UploadOptions {
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
  public?: boolean;
}

/**
 * Upload a file to R2
 * Returns the public URL
 */
export async function uploadFile(
  key: string,
  data: Buffer | Uint8Array | string,
  options: UploadOptions = {}
): Promise<string> {
  const client = getClient();

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: data,
    ContentType: options.contentType || 'application/octet-stream',
    CacheControl: options.cacheControl || 'public, max-age=31536000', // 1 year
    Metadata: options.metadata,
  });

  await client.send(command);

  // Return public URL
  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Upload an image to R2
 */
export async function uploadImage(
  filename: string,
  data: Buffer | Uint8Array,
  options: {
    workspaceId: string;
    contentType?: string;
    folder?: string;
  }
): Promise<string> {
  const { workspaceId, contentType, folder = 'images' } = options;
  
  // Generate key: images/{workspaceId}/{timestamp}-{filename}
  const timestamp = Date.now();
  const key = `${folder}/${workspaceId}/${timestamp}-${filename}`;
  
  return uploadFile(key, data, {
    contentType: contentType || detectImageContentType(filename),
    cacheControl: 'public, max-age=31536000',
    metadata: {
      workspaceId,
      uploadedAt: new Date().toISOString(),
    },
  });
}

/**
 * Upload an export (HTML, PDF, etc.)
 */
export async function uploadExport(
  filename: string,
  data: Buffer | string,
  options: {
    workspaceId: string;
    campaignId?: string;
    contentType?: string;
  }
): Promise<string> {
  const { workspaceId, campaignId, contentType } = options;
  
  // Generate key: exports/{workspaceId}/{campaignId?}/{timestamp}-{filename}
  const timestamp = Date.now();
  const basePath = campaignId 
    ? `exports/${workspaceId}/${campaignId}`
    : `exports/${workspaceId}`;
  const key = `${basePath}/${timestamp}-${filename}`;
  
  return uploadFile(key, typeof data === 'string' ? Buffer.from(data) : data, {
    contentType: contentType || detectContentType(filename),
    cacheControl: 'private, max-age=86400', // 1 day for exports
    metadata: {
      workspaceId,
      campaignId: campaignId || '',
      exportedAt: new Date().toISOString(),
    },
  });
}

// =============================================================================
// Download Functions
// =============================================================================

/**
 * Get a file from R2
 */
export async function getFile(key: string): Promise<Buffer | null> {
  const client = getClient();

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    });

    const response = await client.send(command);
    
    if (!response.Body) {
      return null;
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    // File not found
    if ((error as { name?: string }).name === 'NoSuchKey') {
      return null;
    }
    throw error;
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(key: string): Promise<boolean> {
  const client = getClient();

  try {
    await client.send(new HeadObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a pre-signed URL for temporary access
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const client = getClient();

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Generate a pre-signed URL for uploads
 */
export async function getSignedUploadUrl(
  key: string,
  options: {
    contentType?: string;
    expiresIn?: number;
  } = {}
): Promise<string> {
  const client = getClient();
  const { contentType, expiresIn = 3600 } = options;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

// =============================================================================
// Delete Functions
// =============================================================================

/**
 * Delete a file from R2
 */
export async function deleteFile(key: string): Promise<void> {
  const client = getClient();

  await client.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  }));
}

/**
 * Delete multiple files
 */
export async function deleteFiles(keys: string[]): Promise<void> {
  // R2 doesn't support DeleteObjects, so we delete one by one
  await Promise.all(keys.map(key => deleteFile(key)));
}

// =============================================================================
// List Functions
// =============================================================================

/**
 * List files in a prefix
 */
export async function listFiles(
  prefix: string,
  options: {
    maxKeys?: number;
    continuationToken?: string;
  } = {}
): Promise<{
  files: Array<{ key: string; size: number; lastModified: Date }>;
  nextToken?: string;
}> {
  const client = getClient();

  const response = await client.send(new ListObjectsV2Command({
    Bucket: R2_BUCKET,
    Prefix: prefix,
    MaxKeys: options.maxKeys || 100,
    ContinuationToken: options.continuationToken,
  }));

  return {
    files: (response.Contents || []).map(item => ({
      key: item.Key || '',
      size: item.Size || 0,
      lastModified: item.LastModified || new Date(),
    })),
    nextToken: response.NextContinuationToken,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get public URL for a key
 */
export function getPublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Extract key from public URL
 */
export function getKeyFromUrl(url: string): string | null {
  if (url.startsWith(R2_PUBLIC_URL)) {
    return url.slice(R2_PUBLIC_URL.length + 1);
  }
  return null;
}

/**
 * Detect content type from filename
 */
function detectContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const types: Record<string, string> = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    pdf: 'application/pdf',
    zip: 'application/zip',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };
  
  return types[ext || ''] || 'application/octet-stream';
}

/**
 * Detect image content type
 */
function detectImageContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const types: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    avif: 'image/avif',
  };
  
  return types[ext || ''] || 'image/png';
}
