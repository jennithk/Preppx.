import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { extname } from 'node:path';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fileTypeFromBuffer } from 'file-type';
import { config, hasObjectStorage } from './config.js';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const mimeByExtension = new Map([
  ['pdf', { mime: 'application/pdf', detected: 'application/pdf' }],
  ['mp4', { mime: 'video/mp4', detected: 'video/mp4' }],
  ['webm', { mime: 'video/webm', detected: 'video/webm' }],
  ['pptx', { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', detected: 'application/zip' }],
  ['docx', { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', detected: 'application/zip' }],
  ['ppt', { mime: 'application/vnd.ms-powerpoint', detected: 'application/x-cfb' }],
  ['doc', { mime: 'application/msword', detected: 'application/x-cfb' }],
]);
const client = hasObjectStorage ? new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: config.S3_ACCESS_KEY_ID!, secretAccessKey: config.S3_SECRET_ACCESS_KEY! },
}) : null;

export type AcceptedUpload = {
  key: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
};

export async function uploadLearningMaterial(file: Express.Multer.File): Promise<AcceptedUpload> {
  if (!client || !config.S3_BUCKET) {
    throw Object.assign(new Error('File storage is not configured. Ask the administrator to configure the private S3-compatible bucket before uploading.'), { status: 503, expose: true });
  }
  if (file.size > MAX_FILE_BYTES) {
    throw Object.assign(new Error('Files must be 50 MB or smaller.'), { status: 413 });
  }
  const detected = await fileTypeFromBuffer(file.buffer);
  const extension = extname(file.originalname).toLowerCase().slice(1);
  const allowed = mimeByExtension.get(extension);
  if (!detected || !allowed || detected.mime !== allowed.detected) {
    throw Object.assign(new Error('Unsupported or invalid file. Upload a verified PDF, MP4, WebM, DOC, DOCX, PPT, or PPTX file.'), { status: 415 });
  }

  const key = `learning-materials/${randomUUID()}.${extension}`;
  await client.send(new PutObjectCommand({
    Bucket: config.S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentLength: file.size,
    ContentType: allowed.mime,
    ContentDisposition: `attachment; filename="${file.originalname.replace(/["\\\r\n]/g, '_')}"`,
    ServerSideEncryption: 'AES256',
  }));
  return { key, originalFilename: file.originalname, mimeType: allowed.mime, fileSize: file.size };
}

export async function deleteStoredMaterial(key: string) {
  if (!client || !config.S3_BUCKET) {
    throw Object.assign(new Error('File storage is not configured. Ask the administrator to configure the private S3-compatible bucket before removing stored files.'), { status: 503, expose: true });
  }
  if (!key.startsWith('learning-materials/')) throw new Error('Refusing to delete an object outside the materials prefix.');
  await client.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: key }));
}

export async function getMaterialDownloadUrl(key: string) {
  if (!client || !config.S3_BUCKET) {
    throw Object.assign(new Error('File storage is not configured. Ask the administrator to configure the private S3-compatible bucket before opening materials.'), { status: 503, expose: true });
  }
  const command = new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key });
  return getSignedUrl(client, command, { expiresIn: 300 });
}

export const materialUploadLimits = { maxBytes: MAX_FILE_BYTES, maxFiles: 1 };
