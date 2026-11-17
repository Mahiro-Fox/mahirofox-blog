import path from 'path';
import { PHOTO_DIR } from '@/constant';
import { imageSize } from 'image-size';
import {
  listUploadFiles,
  listUploadSubdirectories,
  readUploadFile,
  readUploadFileHead,
  toUploadUrl,
  type UploadEntry,
} from '@/lib/server/uploads';

export interface PhotoItem {
  id: string;
  src: string;
  filename: string;
  width: number;
  height: number;
  ratio: number;
  alt: string;
  lastUpdatedAt: string;
}

/** 图片尺寸缓存：R2 列表接口拿不到宽高，首次解析后缓存，避免重复请求 */
const sizeCache = new Map<string, { width: number; height: number }>();
const SIZE_CACHE_LIMIT = 500;
/** 只拉取文件头部（WebP/PNG/GIF/JPEG 的宽高都记录在头部） */
const IMAGE_HEADER_BYTES = 64 * 1024;
/** 并发请求数，避免一次图库请求打满 R2 */
const DOWNLOAD_CONCURRENCY = 8;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index]);
      }
    }
  );

  await Promise.all(runners);
  return results;
}

function parseImageSize(buffer: Buffer): { width: number; height: number } {
  const { width, height } = imageSize(buffer);
  if (!width || !height) {
    throw new Error('无法解析图片宽高');
  }
  return { width, height };
}

async function readImageSize(
  entry: UploadEntry
): Promise<{ width: number; height: number }> {
  const cacheKey = `${entry.key}@${entry.lastModified.getTime()}`;
  const cached = sizeCache.get(cacheKey);
  if (cached) {
    // 命中后移到队尾，近似 LRU，避免热点条目被淘汰
    sizeCache.delete(cacheKey);
    sizeCache.set(cacheKey, cached);
    return cached;
  }

  let size: { width: number; height: number };
  try {
    const head = await readUploadFileHead(entry.key, IMAGE_HEADER_BYTES);
    size = parseImageSize(head);
  } catch {
    // 极少数图片的尺寸信息在头部范围之外，兜底完整读取
    size = parseImageSize(await readUploadFile(entry.key));
  }

  // 逐条淘汰最久未使用的记录，避免整表清空导致反复回源
  sizeCache.set(cacheKey, size);
  if (sizeCache.size > SIZE_CACHE_LIMIT) {
    const oldestKey = sizeCache.keys().next().value;
    if (oldestKey !== undefined) sizeCache.delete(oldestKey);
  }
  return size;
}

function toPhotoItem(
  entry: UploadEntry,
  size: { width: number; height: number }
) {
  const id = path.basename(entry.name, path.extname(entry.name));
  const { width, height } = size;

  return {
    id,
    src: toUploadUrl(entry.key),
    filename: entry.name,
    width,
    height,
    ratio: width > 0 && height > 0 ? width / height : 1,
    alt: id,
    lastUpdatedAt: entry.lastModified.toISOString(),
  };
}

/**
 * 获取指定目录下的所有图片
 * 解析图片尺寸并计算宽高比，自动返回可直接访问的 URL
 *
 * limit 用于轮播等只需要少量图片的场景：只对最新的 N 张解析宽高，
 * 避免为整目录每张图都发一次 Range 请求。
 */
export async function getPhotos(
  dir: string = PHOTO_DIR,
  extensions: string[] = ['.webp'],
  limit?: number
): Promise<PhotoItem[]> {
  const all = await listUploadFiles(dir, extensions);
  const files = limit && limit > 0 ? sortByLatest(all).slice(0, limit) : all;

  const images = await mapWithConcurrency(
    files,
    DOWNLOAD_CONCURRENCY,
    async (entry): Promise<PhotoItem | null> => {
      try {
        const size = await readImageSize(entry);
        return toPhotoItem(entry, size);
      } catch (error) {
        console.error(`获取图片元数据失败 ${entry.name}`, error);
        return null;
      }
    }
  );

  return images.filter((img): img is PhotoItem => img !== null);
}

export interface PhotoPage {
  images: PhotoItem[];
  /** 当前目录下符合条件的图片总数 */
  total: number;
}

/** 按最后修改时间倒序，最新的在前 */
function sortByLatest(entries: UploadEntry[]): UploadEntry[] {
  return [...entries].sort(
    (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
  );
}

/**
 * 分页读取指定目录的图片。
 *
 * 只列出文件（ListObjectsV2 很便宜），排序切片后**仅为当前页**解析宽高，
 * 避免为整目录每张图都发一次 Range 请求——目录越大收益越明显。
 */
export async function getPhotosPage(
  dir: string = PHOTO_DIR,
  extensions: string[] = ['.webp'],
  page = 1,
  limit = 12
): Promise<PhotoPage> {
  const files = sortByLatest(await listUploadFiles(dir, extensions));
  const start = Math.max(0, (page - 1) * limit);
  const pageFiles = files.slice(start, start + limit);

  const images = await mapWithConcurrency(
    pageFiles,
    DOWNLOAD_CONCURRENCY,
    async (entry): Promise<PhotoItem | null> => {
      try {
        const size = await readImageSize(entry);
        return toPhotoItem(entry, size);
      } catch (error) {
        console.error(`获取图片元数据失败 ${entry.name}`, error);
        return null;
      }
    }
  );

  return {
    images: images.filter((img): img is PhotoItem => img !== null),
    total: files.length,
  };
}

/**
 * 图库作者（一级子目录）摘要：用于先展示作者，再按作者加载作品。
 */
export interface PhotoCollection {
  /** 子目录名，同时作为作者标识 */
  id: string;
  /** 展示用的作者名 */
  name: string;
  /** 该作者名下的图片数量 */
  count: number;
  /** 封面图 URL，取该目录中最新的图片 */
  cover: string | null;
  width: number;
  height: number;
  ratio: number;
  lastUpdatedAt: string;
}

/**
 * 读取指定目录下的一级子目录，聚合为作者列表。
 * 只读取封面图的元数据，避免为统计数量而解析整目录的图片。
 */
export async function getPhotoCollections(
  dir: string,
  extensions: string[] = ['.webp']
): Promise<PhotoCollection[]> {
  const directories = await listUploadSubdirectories(dir);

  const collections = await Promise.all(
    directories
      .filter(
        (entry) => !entry.name.startsWith('.') && !entry.name.startsWith('_')
      )
      .map(async (entry): Promise<PhotoCollection | null> => {
        try {
          const files = await listUploadFiles(entry.dir, extensions);
          if (files.length === 0) return null;

          // 取最新修改的图片作为封面
          const newest = files.reduce((latest, file) =>
            file.lastModified > latest.lastModified ? file : latest
          );

          let size = { width: 0, height: 0 };
          try {
            size = await readImageSize(newest);
          } catch (error) {
            console.error(`获取封面元数据失败 ${entry.name}`, error);
          }

          return {
            id: entry.name,
            name: entry.name,
            count: files.length,
            cover: toUploadUrl(newest.key),
            width: size.width,
            height: size.height,
            ratio:
              size.width > 0 && size.height > 0 ? size.width / size.height : 1,
            lastUpdatedAt: newest.lastModified.toISOString(),
          };
        } catch (error) {
          console.error(`读取作者目录失败 ${entry.name}`, error);
          return null;
        }
      })
  );

  return collections
    .filter((collection): collection is PhotoCollection => collection !== null)
    .sort((a, b) => b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
}
