import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private configured: boolean = false;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('STORAGE_REGION') || 'us-east-1';
    const endpoint = this.configService.get<string>('STORAGE_ENDPOINT');
    const accessKeyId = this.configService.get<string>('STORAGE_ACCESS_KEY');
    const secretAccessKey = this.configService.get<string>('STORAGE_SECRET_KEY');
    this.bucketName = this.configService.get<string>('STORAGE_BUCKET') || '';

    if (accessKeyId && secretAccessKey && this.bucketName) {
      this.s3Client = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: !!endpoint, // Needed for MinIO or some S3 compatible providers
      });
      this.configured = true;
      this.logger.log(`StorageService initialized with bucket: ${this.bucketName}`);
    } else {
      this.logger.warn('StorageService missing configuration (STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY, or STORAGE_BUCKET). Uploads will be disabled.');
    }
  }

  /**
   * Check if storage is properly configured
   */
  isConfigured(): boolean {
    return this.configured;
  }

  async uploadFile(file: any, folder: string = 'uploads'): Promise<{ url: string; key: string }> {
    if (!this.s3Client || !this.configured) {
      this.logger.warn('Attempted file upload but storage is not configured');
      throw new ServiceUnavailableException({
        code: 'UPLOADS_DISABLED',
        message: 'File uploads are not configured in this environment.'
      });
    }

    try {
      const fileExtension = file.originalname.split('.').pop();
      const key = `${folder}/${uuidv4()}.${fileExtension}`;

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'private',
        }),
      );

      // Construct generic S3 URL or use custom domain
      const endpoint = this.configService.get<string>('STORAGE_PUBLIC_URL') ||
        (this.configService.get<string>('STORAGE_ENDPOINT') ?
          `${this.configService.get<string>('STORAGE_ENDPOINT')}/${this.bucketName}` :
          `https://${this.bucketName}.s3.amazonaws.com`);

      const url = `${endpoint}/${key}`;

      return { url, key };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
      throw new ServiceUnavailableException({
        code: 'UPLOAD_FAILED',
        message: 'Failed to upload file to storage.'
      });
    }
  }

  async deleteFile(key: string): Promise<void> {
    if (!this.s3Client || !this.configured) {
      this.logger.warn('Attempted file deletion but storage is not configured');
      // Silently fail deletion if storage not configured - attachment record can still be removed
      return;
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}: ${error.message}`, error.stack);
      // Don't throw - allow attachment record deletion to proceed
    }
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!this.s3Client || !this.configured) {
      this.logger.warn('Attempted to get signed URL but storage is not configured');
      return '';
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });
      return getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for ${key}: ${error.message}`, error.stack);
      return '';
    }
  }
}
