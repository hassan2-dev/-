import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PresignUploadDto } from './dto/presign.dto';

@Injectable()
export class UploadsService {
  private client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): S3Client {
    if (this.client) return this.client;

    const accountId = this.config.get<string>('r2.accountId');
    const accessKeyId = this.config.get<string>('r2.accessKeyId');
    const secretAccessKey = this.config.get<string>('r2.secretAccessKey');
    const endpoint =
      this.config.get<string>('r2.endpoint') ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

    if (!accountId || !accessKeyId || !secretAccessKey || !endpoint) {
      throw new ServiceUnavailableException(
        'Cloudflare R2 is not configured. Set R2_* env vars.',
      );
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      // R2 rejects presigned PUTs when the SDK bakes a default CRC32 checksum
      // (of an empty body) into the URL. Only compute checksums when required.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    return this.client;
  }

  async createPresignedUpload(dto: PresignUploadDto) {
    if (!dto.contentType.startsWith('image/')) {
      throw new BadRequestException('Only image uploads are allowed');
    }

    const bucket = this.config.getOrThrow<string>('r2.bucket');
    const publicUrl = this.config.get<string>('r2.publicUrl');
    const folder = (dto.folder || 'uploads').replace(/[^a-zA-Z0-9/_-]/g, '');
    const ext = extname(dto.filename) || '.jpg';
    const key = `${folder}/${randomUUID()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: dto.contentType,
    });

    const uploadUrl = await getSignedUrl(this.getClient(), command, {
      expiresIn: 600,
    });

    const url = publicUrl
      ? `${publicUrl.replace(/\/$/, '')}/${key}`
      : uploadUrl.split('?')[0];

    return { uploadUrl, key, publicUrl: url, expiresIn: 600 };
  }
}
