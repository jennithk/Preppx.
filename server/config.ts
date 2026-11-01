import 'dotenv/config';
import { z } from 'zod';

const optionalNonempty = z.string().trim().min(1).optional();
const httpUrl = z.string().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Use an HTTP or HTTPS URL.');
const optionalEmailSetting = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
);

const environmentSchema = z.object({
  DATABASE_URL: z.string().url().refine((value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol), 'Use a PostgreSQL connection URL.'),
  MANAGEMENT_JWT_SECRET: z.string().min(32),
  FRONTEND_ORIGIN: httpUrl,
  FRONTEND_ORIGINS: z.string().optional()
    .transform((value) => (value ?? '').split(',').map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(httpUrl)),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  COOKIE_SECURE: z.string().optional().transform((value) => value === 'true'),
  MANAGEMENT_BOOTSTRAP_NAME: optionalNonempty,
  MANAGEMENT_BOOTSTRAP_EMAIL: z.string().email().optional(),
  MANAGEMENT_BOOTSTRAP_PASSWORD: z.string().min(12).optional(),
  RESEND_API_KEY: optionalEmailSetting,
  EMAIL_FROM: optionalEmailSetting,
  S3_ENDPOINT: httpUrl.optional(),
  S3_REGION: optionalNonempty,
  S3_BUCKET: optionalNonempty,
  S3_ACCESS_KEY_ID: optionalNonempty,
  S3_SECRET_ACCESS_KEY: optionalNonempty,
});

export const config = environmentSchema.parse(process.env);
export const frontendOrigins = new Set([config.FRONTEND_ORIGIN, ...config.FRONTEND_ORIGINS]);

const bootstrapValues = [
  config.MANAGEMENT_BOOTSTRAP_NAME,
  config.MANAGEMENT_BOOTSTRAP_EMAIL,
  config.MANAGEMENT_BOOTSTRAP_PASSWORD,
];
if (bootstrapValues.some(Boolean) && !bootstrapValues.every(Boolean)) {
  throw new Error('Set MANAGEMENT_BOOTSTRAP_NAME, MANAGEMENT_BOOTSTRAP_EMAIL, and MANAGEMENT_BOOTSTRAP_PASSWORD together.');
}

const storageValues = [
  config.S3_ENDPOINT,
  config.S3_REGION,
  config.S3_BUCKET,
  config.S3_ACCESS_KEY_ID,
  config.S3_SECRET_ACCESS_KEY,
];
if (storageValues.some(Boolean) && !storageValues.every(Boolean)) {
  throw new Error('Configure all S3 storage variables together or leave them all empty.');
}

export const hasObjectStorage = storageValues.every(Boolean);
export function isValidEmailSender(value: string | undefined) {
  if (!value || /[\r\n]/.test(value)) return false;
  const match = /^(?:[^<>]+\s*<([^<>]+)>|([^<>]+))$/.exec(value);
  const address = match?.[1]?.trim() ?? match?.[2]?.trim();
  return Boolean(address && z.string().email().safeParse(address).success);
}
export const hasEmailDelivery = Boolean(config.RESEND_API_KEY && isValidEmailSender(config.EMAIL_FROM));
