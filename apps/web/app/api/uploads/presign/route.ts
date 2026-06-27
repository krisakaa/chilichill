import { createHash, createHmac, randomUUID } from 'crypto';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_UPLOAD_AGE = 60 * 5;
const ALLOWED_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value).digest();
}

function hexHmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value).digest('hex');
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function amzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function dateStamp(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function sanitizeBaseName(filename: string) {
  const base = filename.replace(/\.[^.]+$/u, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return base.slice(0, 40) || 'image';
}

function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function signingKey(secret: string, date: string, region: string, service: string) {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function presignPutUrl(input: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  key: string;
  contentType: string;
}) {
  const now = new Date();
  const region = 'auto';
  const service = 's3';
  const host = `${input.accountId}.r2.cloudflarestorage.com`;
  const encodedKey = encodePath(input.key);
  const canonicalUri = `/${input.bucket}/${encodedKey}`;
  const date = dateStamp(now);
  const timestamp = amzDate(now);
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const signedHeaders = 'content-type;host';
  const credential = `${input.accessKeyId}/${credentialScope}`;
  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': timestamp,
    'X-Amz-Expires': String(MAX_UPLOAD_AGE),
    'X-Amz-SignedHeaders': signedHeaders,
  });
  params.sort();

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    params.toString(),
    `content-type:${input.contentType}\nhost:${host}\n`,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    credentialScope,
    hash(canonicalRequest),
  ].join('\n');
  const signature = hexHmac(signingKey(input.secretAccessKey, date, region, service), stringToSign);
  params.set('X-Amz-Signature', signature);

  return `https://${host}${canonicalUri}?${params.toString()}`;
}

export async function POST(request: Request) {
  let input: { filename?: string; contentType?: string; size?: number };
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const filename = input.filename ?? 'image';
  const contentType = input.contentType ?? '';
  const size = Number(input.size ?? 0);
  const ext = ALLOWED_TYPES.get(contentType);
  if (!ext) return Response.json({ error: 'Unsupported image type' }, { status: 400 });
  if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_SIZE) {
    return Response.json({ error: 'Image must be 10MB or smaller' }, { status: 400 });
  }

  try {
    const accountId = env('R2_ACCOUNT_ID');
    const accessKeyId = env('R2_ACCESS_KEY_ID');
    const secretAccessKey = env('R2_SECRET_ACCESS_KEY');
    const bucket = env('R2_BUCKET');
    const publicBaseUrl = env('R2_PUBLIC_BASE_URL').replace(/\/+$/u, '');
    const today = new Date().toISOString().slice(0, 7).replace('-', '/');
    const key = `messages/${today}/${randomUUID()}-${sanitizeBaseName(filename)}.${ext}`;
    const uploadUrl = presignPutUrl({ accountId, accessKeyId, secretAccessKey, bucket, key, contentType });
    return Response.json({
      uploadUrl,
      publicUrl: `${publicBaseUrl}/${key}`,
      key,
      maxSize: MAX_FILE_SIZE,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'R2 upload is not configured' }, { status: 503 });
  }
}