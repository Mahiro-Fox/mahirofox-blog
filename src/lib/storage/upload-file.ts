import path from 'path';
import { optionalIntEnv } from '@/config';
import { MAX_FILE_SIZE } from '@/constant';
import { imageSize } from 'image-size';
import sharp from 'sharp';
import {
  putUploadFile,
  resolveUploadKey,
  uploadFileExists,
} from '@/lib/storage/uploads';

/**
 * 服务端文件上传（写 R2，未配置时写本地 uploads）。
 * 由原先的 Go /api/uploads/asset 迁移而来，语义保持一致：
 * - 文件名做安全化处理，重名直接报错，不覆盖；
 * - 图片：非 WebP 转 WebP 并额外保留源文件；WebP 原样保存；
 * - 其他文件：原样保存。
 */

/**
 * WebP 转换质量（可选环境变量 WEBP_QUALITY）。
 * 未配置或非法时告警并返回 undefined，由 sharp 使用自身默认质量。
 */
function webpQuality(): number | undefined {
  return optionalIntEnv('WEBP_QUALITY');
}

const DANGEROUS_EXTENSIONS = new Set([
  'exe',
  'bat',
  'cmd',
  'com',
  'cpl',
  'dll',
  'js',
  'jse',
  'msi',
  'msp',
  'ps1',
  'scr',
  'sh',
  'vbe',
  'vbs',
  'wsf',
  'wsh',
  'jar',
  'php',
  'py',
  'rb',
  'html',
  'htm',
  'svg',
]);

const RAW_EXTENSIONS = new Set([
  '.mid',
  '.midi',
  '.mp3',
  '.wav',
  '.m4a',
  '.mp4',
  '.webm',
  '.pdf',
  '.md',
  '.mdx',
  '.json',
  '.txt',
]);

export interface UploadAssetOptions {
  /** uploads 下的子目录，如 images/blog */
  dir: string;
  /** image：走 WebP 处理；raw：原样保存 */
  target: 'image' | 'raw';
  /** 图片质量，默认 50 */
  quality?: number;
}

export interface UploadAssetResult {
  url: string;
  width: number;
  height: number;
  converted: boolean;
}

function normalizeDir(dir: string): string {
  const normalized = dir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (normalized.split('/').some((segment) => segment === '..')) {
    throw new Error('非法的上传目录');
  }
  return normalized;
}

function sanitizeFileName(name: string): string {
  const sanitized = name
    .replace(/[^\w\u4e00-\u9fa5.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+/, '');
  return sanitized || 'upload';
}

function detectMime(buffer: Buffer): string {
  const ascii = (start: number, end: number) =>
    buffer.subarray(start, end).toString('ascii');

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') {
    return 'image/gif';
  }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (ascii(0, 4) === 'MThd') {
    return 'audio/midi';
  }
  if (
    ascii(0, 3) === 'ID3' ||
    (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  ) {
    return 'audio/mpeg';
  }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') {
    return 'audio/wav';
  }
  if (ascii(4, 8) === 'ftyp') {
    return 'video/mp4';
  }
  if (ascii(0, 4) === '%PDF') {
    return 'application/pdf';
  }
  return 'application/octet-stream';
}

function isAllowedUpload(
  mime: string,
  fileName: string,
  target: 'image' | 'raw'
): boolean {
  const ext = path.extname(fileName).toLowerCase();
  if (DANGEROUS_EXTENSIONS.has(ext.replace(/^\./, ''))) return false;

  if (target === 'image') {
    return mime.startsWith('image/');
  }
  if (mime.startsWith('image/')) return true;
  if (
    mime.startsWith('audio/') ||
    mime.startsWith('video/') ||
    mime === 'application/pdf'
  ) {
    return true;
  }
  return RAW_EXTENSIONS.has(ext);
}

async function saveBuffer(
  dir: string,
  fileName: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const key = resolveUploadKey(`${dir}/${fileName}`);
  if (await uploadFileExists(key)) {
    throw new Error(`文件 ${fileName} 已存在`);
  }
  await putUploadFile(key, buffer, contentType);
  return `/uploads/${dir}/${fileName}`;
}

/** 上传单个文件到 uploads 存储 */
export async function uploadAssetFile(
  file: File,
  options: UploadAssetOptions
): Promise<UploadAssetResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`文件大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const dir = normalizeDir(options.dir);
  const fileName = sanitizeFileName(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectMime(buffer);
  const mime = detected === 'application/octet-stream' ? file.type : detected;

  if (!isAllowedUpload(mime, fileName, options.target)) {
    throw new Error(`不支持的文件类型: ${fileName}`);
  }

  if (options.target === 'image') {
    const isWebp =
      mime === 'image/webp' || fileName.toLowerCase().endsWith('.webp');

    if (isWebp) {
      const { width = 0, height = 0 } = imageSize(buffer);
      const url = await saveBuffer(dir, fileName, buffer, 'image/webp');
      return { url, width, height, converted: false };
    }

    // 先保留源文件，再保存转换后的 WebP
    await saveBuffer(dir, fileName, buffer, mime);

    const processed = await sharp(buffer)
      .webp({ quality: options.quality ?? webpQuality() })
      .toBuffer({ resolveWithObject: true });
    const baseName = fileName.replace(/\.[^/.]+$/, '') || 'upload';
    const url = await saveBuffer(
      dir,
      `${baseName}.webp`,
      processed.data,
      'image/webp'
    );

    return {
      url,
      width: processed.info.width,
      height: processed.info.height,
      converted: true,
    };
  }

  const url = await saveBuffer(dir, fileName, buffer, mime);
  return { url, width: 0, height: 0, converted: false };
}
