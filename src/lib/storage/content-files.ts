import matter from 'gray-matter';
import { BLOG_DIR, GALLERY_DIR } from '@/constant/dir';
import {
  deleteUploadFile,
  listUploadFiles,
  putUploadFile,
  readUploadFile,
  renameUploadEntry,
  resolveUploadKey,
  uploadFileExists,
} from './uploads';

/**
 * 内容文件访问层（blog 的 .mdx、gallery 的 .json）。
 * - 配置了 R2 时读写 R2，未配置时写本地 uploads 目录
 * - 只负责文件层面的增删改查与元数据解析，业务校验留在 action 层
 */

const BLOG_EXT = '.mdx';
const GALLERY_EXT = '.json';
const BLOG_CONTENT_TYPE = 'text/markdown; charset=utf-8';
const GALLERY_CONTENT_TYPE = 'application/json; charset=utf-8';

function blogKey(slug: string): string {
  return resolveUploadKey(`uploads/content/blog/${slug}${BLOG_EXT}`);
}

function galleryKey(slug: string): string {
  return resolveUploadKey(`uploads/content/gallery/${slug}${GALLERY_EXT}`);
}

function toStringField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function sortByLastUpdatedDesc<T extends { lastUpdated: string }>(
  items: T[]
): T[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.lastUpdated || 0).getTime() -
      new Date(a.lastUpdated || 0).getTime()
  );
}

/**
 * 列表结果短缓存：首页等页面每次渲染都会列出全部内容文件，
 * 不缓存的话每次渲染都要 ListObjects + 逐个读取 R2 对象。
 */
const LIST_CACHE_TTL_MS = 60_000;
type ListBucket = 'blog' | 'gallery';
const listCache = new Map<
  ListBucket,
  { value: unknown; expiresAt: number }
>();

function invalidateListCache(bucket: ListBucket): void {
  listCache.delete(bucket);
}

async function withListCache<T>(
  bucket: ListBucket,
  loader: () => Promise<T>
): Promise<T> {
  const hit = listCache.get(bucket);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const value = await loader();
  listCache.set(bucket, { value, expiresAt: Date.now() + LIST_CACHE_TTL_MS });
  return value;
}

// ------------------------------------------------------------
// Blog（MDX）
// ------------------------------------------------------------

/** 列出所有博客文件并解析 frontmatter（结果缓存 60s，写操作时失效） */
export async function listBlogFiles(): Promise<AdminBlog[]> {
  const cached = await withListCache('blog', loadBlogFiles);
  return [...cached];
}

async function loadBlogFiles(): Promise<AdminBlog[]> {
  const files = await listUploadFiles(BLOG_DIR, [BLOG_EXT]);
  const items = await Promise.all(
    files.map(async (file): Promise<AdminBlog | null> => {
      try {
        const raw = await readUploadFile(file.key);
        const parsed = matter(raw.toString('utf-8'));
        const slug = file.name.replace(/\.mdx$/i, '');
        return {
          slug,
          fileName: file.name,
          size: file.size,
          title: toStringField(parsed.data.title) || '无标题',
          description: toStringField(parsed.data.description),
          thumbnail: toStringField(parsed.data.thumbnail) || undefined,
          isPortrait: parsed.data.isPortrait === true,
          lastUpdated: toStringField(parsed.data.lastUpdated),
          tags: toStringArray(parsed.data.tags),
          rawContent: '',
          renderContent: '',
        };
      } catch {
        return null;
      }
    })
  );

  return sortByLastUpdatedDesc(
    items.filter((item): item is AdminBlog => item !== null)
  );
}

/** 读取 MDX 原文 */
export async function readBlogFile(slug: string): Promise<string> {
  const buffer = await readUploadFile(blogKey(slug)).catch(() => null);
  if (!buffer) throw new Error('文件不存在');
  return buffer.toString('utf-8');
}

/** 创建 MDX 文件（重名报错，不覆盖） */
export async function createBlogFile(
  slug: string,
  content: string
): Promise<void> {
  if (await uploadFileExists(blogKey(slug))) {
    throw new Error(`文件 ${slug}${BLOG_EXT} 已存在`);
  }
  await putUploadFile(blogKey(slug), content, BLOG_CONTENT_TYPE);
  invalidateListCache('blog');
}

/** 更新 MDX 文件 */
export async function updateBlogFile(
  slug: string,
  content: string
): Promise<void> {
  if (!(await uploadFileExists(blogKey(slug)))) {
    throw new Error('文件不存在');
  }
  await putUploadFile(blogKey(slug), content, BLOG_CONTENT_TYPE);
  invalidateListCache('blog');
}

/** 重命名 MDX 文件 */
export async function renameBlogFile(
  slug: string,
  newSlug: string
): Promise<void> {
  if (!(await uploadFileExists(blogKey(slug)))) {
    throw new Error('原文件不存在');
  }
  if (await uploadFileExists(blogKey(newSlug))) {
    throw new Error(`文件 ${newSlug}${BLOG_EXT} 已存在`);
  }
  await renameUploadEntry(blogKey(slug), `${newSlug}${BLOG_EXT}`);
  invalidateListCache('blog');
}

/** 删除 MDX 文件 */
export async function deleteBlogFile(slug: string): Promise<void> {
  if (!(await uploadFileExists(blogKey(slug)))) {
    throw new Error('文件不存在');
  }
  await deleteUploadFile(blogKey(slug));
  invalidateListCache('blog');
}

// ------------------------------------------------------------
// Gallery（JSON）
// ------------------------------------------------------------

/** 解析 JSON 内容，非法时抛错 */
export function parseGalleryJson(content: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('JSON 格式无效');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON 格式无效');
  }
  return parsed as Record<string, unknown>;
}

/** 校验并格式化 JSON（2 空格缩进） */
export function formatGalleryJson(content: string): string {
  return JSON.stringify(parseGalleryJson(content), null, 2);
}

/** 列出所有图库文件并解析 JSON（结果缓存 60s，写操作时失效） */
export async function listGalleryFiles(): Promise<AdminGallery[]> {
  const cached = await withListCache('gallery', loadGalleryFiles);
  return [...cached];
}

async function loadGalleryFiles(): Promise<AdminGallery[]> {
  const files = await listUploadFiles(GALLERY_DIR, [GALLERY_EXT]);
  const items = await Promise.all(
    files.map(async (file): Promise<AdminGallery | null> => {
      try {
        const raw = await readUploadFile(file.key);
        const data = parseGalleryJson(raw.toString('utf-8'));
        return {
          slug: file.name.replace(/\.json$/i, ''),
          fileName: file.name,
          size: file.size,
          title: toStringField(data.title) || '无标题',
          description: toStringField(data.description),
          thumbnail: toStringField(data.thumbnail),
          isPortrait: data.isPortrait === true,
          lastUpdated: toStringField(data.lastUpdated),
          tags: toStringArray(data.tags),
        };
      } catch {
        return null;
      }
    })
  );

  return sortByLastUpdatedDesc(
    items.filter((item): item is AdminGallery => item !== null)
  );
}

/** 读取图库 JSON 原文 */
export async function readGalleryFile(slug: string): Promise<string> {
  const buffer = await readUploadFile(galleryKey(slug)).catch(() => null);
  if (!buffer) throw new Error('文件不存在');
  return buffer.toString('utf-8');
}

/** 读取图库 JSON 并解析，附带文件元信息 */
export async function readGalleryDetail(
  slug: string
): Promise<AdminGallery> {
  const content = await readGalleryFile(slug);
  const data = parseGalleryJson(content);
  return {
    slug,
    fileName: `${slug}${GALLERY_EXT}`,
    size: Buffer.byteLength(content, 'utf-8'),
    title: toStringField(data.title) || '无标题',
    description: toStringField(data.description),
    thumbnail: toStringField(data.thumbnail),
    isPortrait: data.isPortrait === true,
    lastUpdated: toStringField(data.lastUpdated),
    tags: toStringArray(data.tags),
  };
}

/** 创建图库 JSON 文件（重名报错，不覆盖） */
export async function createGalleryFile(
  slug: string,
  content: string
): Promise<void> {
  const formatted = formatGalleryJson(content);
  if (await uploadFileExists(galleryKey(slug))) {
    throw new Error(`文件 ${slug}${GALLERY_EXT} 已存在`);
  }
  await putUploadFile(galleryKey(slug), formatted, GALLERY_CONTENT_TYPE);
  invalidateListCache('gallery');
}

/** 更新图库 JSON 文件 */
export async function updateGalleryFile(
  slug: string,
  content: string
): Promise<void> {
  const formatted = formatGalleryJson(content);
  if (!(await uploadFileExists(galleryKey(slug)))) {
    throw new Error('文件不存在');
  }
  await putUploadFile(galleryKey(slug), formatted, GALLERY_CONTENT_TYPE);
  invalidateListCache('gallery');
}

/** 重命名图库 JSON 文件 */
export async function renameGalleryFile(
  slug: string,
  newSlug: string
): Promise<void> {
  if (!(await uploadFileExists(galleryKey(slug)))) {
    throw new Error('原文件不存在');
  }
  if (await uploadFileExists(galleryKey(newSlug))) {
    throw new Error(`文件 ${newSlug}${GALLERY_EXT} 已存在`);
  }
  await renameUploadEntry(galleryKey(slug), `${newSlug}${GALLERY_EXT}`);
  invalidateListCache('gallery');
}

/** 删除图库 JSON 文件 */
export async function deleteGalleryFile(slug: string): Promise<void> {
  if (!(await uploadFileExists(galleryKey(slug)))) {
    throw new Error('文件不存在');
  }
  await deleteUploadFile(galleryKey(slug));
  invalidateListCache('gallery');
}
