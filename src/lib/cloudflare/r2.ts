import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

/**
 * Cloudflare R2（S3 兼容）最小 CRUD 封装。
 *
 * R2 中沿用本地 uploads/ 目录结构，例如：
 *   uploads/images/gallery/xxx.webp  =>  key = "uploads/images/gallery/xxx.webp"
 * 这样数据库/富文本里的 `/uploads/...` 逻辑路径保持不变，
 * 由入口中间件统一 301 到静态域名。
 */

export interface R2ObjectInfo {
  key: string;
  size: number;
  lastModified: Date;
}

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export const R2_UPLOADS_PREFIX = 'uploads/';

function readConfig(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function requireConfig(): R2Config {
  const config = readConfig();
  if (!config) {
    throw new Error(
      'R2 未配置，请设置 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_ACCESS_KEY / R2_BUCKET'
    );
  }
  return config;
}

let cachedClient: S3Client | null = null;

function getClient(config: R2Config): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return cachedClient;
}

/** 是否已配置 R2；未配置时上层退回本地 uploads 目录（便于本地开发） */
export function isR2Configured(): boolean {
  return readConfig() !== null;
}

/**
 * 把 `/uploads/a.webp`、`uploads/a.webp`、`images/a.webp` 统一成 R2 key。
 */
export function toUploadsKey(pathname: string): string {
  const normalized = pathname.replace(/\\/g, '/').replace(/^\/+/, '');
  return normalized.startsWith(R2_UPLOADS_PREFIX)
    ? normalized
    : `${R2_UPLOADS_PREFIX}${normalized}`;
}

/** 列出指定前缀下的所有对象（自动翻页，不含目录占位符） */
export async function listR2Objects(prefix: string): Promise<R2ObjectInfo[]> {
  const config = requireConfig();
  const client = getClient(config);
  const objects: R2ObjectInfo[] = [];
  let continuationToken: string | undefined;

  do {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    for (const item of result.Contents ?? []) {
      if (!item.Key || item.Key.endsWith('/')) continue;
      objects.push({
        key: item.Key,
        size: item.Size ?? 0,
        lastModified: item.LastModified ?? new Date(0),
      });
    }

    continuationToken = result.IsTruncated
      ? result.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return objects;
}

/** 只列出指定前缀下的一级子目录名 */
export async function listR2Directories(prefix: string): Promise<string[]> {
  const config = requireConfig();
  const client = getClient(config);
  const base = prefix.endsWith('/') ? prefix : `${prefix}/`;
  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: base,
      Delimiter: '/',
    })
  );

  return (result.CommonPrefixes ?? [])
    .map((item) => item.Prefix)
    .filter((item): item is string => Boolean(item))
    .map((item) => item.slice(base.length).replace(/\/$/, ''))
    .filter((item) => item.length > 0);
}

export interface R2DirectoryContents {
  /** 该层级的文件（不含目录占位符） */
  files: R2ObjectInfo[];
  /** 该层级的一级子目录，值为完整前缀（末尾带 /） */
  directories: string[];
}

/**
 * 只列出某个前缀下一层的文件与子目录。
 *
 * 单次 delimiter 请求即可拿到两者，避免像递归列表那样把整棵子树的
 * 对象都拉一遍（uploads/ 上万对象时差距是几十倍）。
 */
export async function listR2DirectoryContents(
  prefix: string
): Promise<R2DirectoryContents> {
  const config = requireConfig();
  const client = getClient(config);
  const base = prefix.endsWith('/') ? prefix : `${prefix}/`;
  const files: R2ObjectInfo[] = [];
  const directories: string[] = [];
  let continuationToken: string | undefined;

  do {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: base,
        Delimiter: '/',
        ContinuationToken: continuationToken,
      })
    );

    for (const item of result.Contents ?? []) {
      // 以 / 结尾的是目录占位对象，已在 CommonPrefixes 中体现
      if (!item.Key || item.Key.endsWith('/')) continue;
      files.push({
        key: item.Key,
        size: item.Size ?? 0,
        lastModified: item.LastModified ?? new Date(0),
      });
    }

    for (const item of result.CommonPrefixes ?? []) {
      if (item.Prefix) directories.push(item.Prefix);
    }

    continuationToken = result.IsTruncated
      ? result.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return { files, directories };
}

/** 读取对象内容 */
export async function getR2ObjectBuffer(key: string): Promise<Buffer> {
  const config = requireConfig();
  const client = getClient(config);
  const result = await client.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key })
  );

  if (!result.Body) {
    throw new Error(`R2 对象为空: ${key}`);
  }

  const bytes = await result.Body.transformToByteArray();
  return Buffer.from(bytes);
}

/** 读取对象指定字节范围，用于只拉取图片头部 */
export async function getR2ObjectRange(
  key: string,
  start: number,
  end: number
): Promise<Buffer> {
  const config = requireConfig();
  const client = getClient(config);
  const result = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Range: `bytes=${start}-${end}`,
    })
  );

  if (!result.Body) {
    throw new Error(`R2 对象为空: ${key}`);
  }

  const bytes = await result.Body.transformToByteArray();
  return Buffer.from(bytes);
}

/** 上传/覆盖对象 */
export async function putR2Object(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType = 'application/octet-stream'
): Promise<void> {
  const config = requireConfig();
  const client = getClient(config);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/** 删除对象（对象不存在时 S3 语义下也视为成功） */
export async function deleteR2Object(key: string): Promise<void> {
  const config = requireConfig();
  const client = getClient(config);
  await client.send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: key })
  );
}

/** 服务端复制对象（用于重命名：复制后删除源对象） */
export async function copyR2Object(
  sourceKey: string,
  targetKey: string
): Promise<void> {
  const config = requireConfig();
  const client = getClient(config);
  await client.send(
    new CopyObjectCommand({
      Bucket: config.bucket,
      CopySource: `${config.bucket}/${sourceKey}`,
      Key: targetKey,
    })
  );
}

/** 判断对象是否存在 */
export async function r2ObjectExists(key: string): Promise<boolean> {
  const config = requireConfig();
  const client = getClient(config);
  try {
    await client.send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: key })
    );
    return true;
  } catch {
    return false;
  }
}
