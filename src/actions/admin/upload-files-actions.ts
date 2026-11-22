'use server';

import path from 'path';
import {
  MAX_FILE_SIZE,
  MAX_FILES_COUNT,
  MAX_TOTAL_SIZE,
  UPLOADS_DIR,
} from '@/constant';
import { pathCacheStore } from '@/store/path-cache-store';
import { isR2Configured, presignR2PutUrl } from '@/lib/cloudflare/r2';
import {
  isUploadMimeAllowed,
  sanitizeFileName,
  uploadAssetBuffer,
  uploadAssetFile,
} from '@/lib/storage/upload-file';
import {
  createUploadDirectory,
  deleteUploadDirectory,
  deleteUploadFile,
  getUploadFileMeta,
  isUploadDirectory,
  listUploadEntries,
  readUploadFile,
  renameUploadEntry,
  resolveUploadKey,
  uploadFileExists,
} from '@/lib/storage/uploads';
import {
  withActionPermission,
  type ActionResponse,
} from '@/utils/action-response';
import { createLogger } from '@/utils/logger';

const logger = createLogger('UploadFilesActions');

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  lastUpdated: string;
  extension?: string;
}

export interface FileListResponse {
  items: FileItem[];
  currentPath: string;
  breadcrumb: string[];
}

/** 去掉首尾斜杠并阻止路径穿越 */
function normalizeRelativePath(input?: string): string {
  const trimmed = (input ?? '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!trimmed) return '';
  const segments = trimmed.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('非法的路径');
  }
  return segments.join('/');
}

function assertValidName(name: string, label: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error(`${label}不能为空`);
  if (
    trimmed.includes('/') ||
    trimmed.includes('\\') ||
    trimmed === '.' ||
    trimmed === '..'
  ) {
    throw new Error(`${label}包含非法字符`);
  }
  return trimmed;
}

/** 相对路径 → 本地绝对目录（uploads 存储层用绝对目录映射 R2 前缀） */
function toAbsoluteDir(relativePath: string): string {
  return relativePath
    ? path.join(UPLOADS_DIR, ...relativePath.split('/'))
    : UPLOADS_DIR;
}

function toLogicalPath(relativePath: string, name: string): string {
  return `/uploads/${relativePath ? `${relativePath}/` : ''}${name}`;
}

// POST - 上传文件
export async function adminUploadFiles(formData: FormData): Promise<
  ActionResponse<{
    message: string;
    results: {
      name: string;
      path: string;
      success: boolean;
      converted?: boolean;
      error?: string;
    }[];
  }>
> {
  return withActionPermission('files:upload', async (user) => {
    try {
      const pathValue = formData.get('path') as string | null;
      const relativePath = normalizeRelativePath(pathValue ?? '');

      const files = formData.getAll('files') as File[];
      if (files.length === 0) {
        return { success: false, error: '没有提供文件' };
      }

      const results: {
        name: string;
        path: string;
        success: boolean;
        converted?: boolean;
        error?: string;
      }[] = [];

      for (const file of files) {
        try {
          const isImage =
            file.type.startsWith('image/') ||
            /\.(webp|png|jpe?g|gif)$/i.test(file.name);
          const data = await uploadAssetFile(file, {
            dir: relativePath,
            target: isImage ? 'image' : 'raw',
          });
          results.push({
            name: file.name,
            path: data.url,
            success: true,
            converted: data.converted,
          });
        } catch (error) {
          results.push({
            name: file.name,
            path: '',
            success: false,
            error: error instanceof Error ? error.message : '上传失败',
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      logger.info('上传文件完成', {
        count: files.length,
        relativePath,
        userId: user.id,
      });
      return {
        success: true,
        data: {
          message: `上传完成: ${successCount} 成功, ${failCount} 失败`,
          results,
        },
      };
    } catch (error) {
      logger.error('上传文件失败', error);
      return { success: false, error: '上传失败' };
    }
  });
}

export interface PresignUploadInput {
  /** 浏览器端原始文件名 */
  name: string;
  size: number;
  type: string;
}

export interface PresignUploadItem {
  /** 原始文件名，用于结果提示 */
  name: string;
  /** 安全化后的文件名（与签名里的 key 一致） */
  fileName?: string;
  /** R2 key */
  key?: string;
  /** 预签名 PUT 地址 */
  uploadUrl?: string;
  contentType?: string;
  target?: 'image' | 'raw';
  error?: string;
}

export interface UploadFileResultItem {
  name: string;
  path: string;
  success: boolean;
  converted?: boolean;
  error?: string;
}

/** 按文件名 / MIME 判断走图片处理还是原样保存（与原上传逻辑保持一致） */
function deriveUploadTarget(name: string, type: string): 'image' | 'raw' {
  return type.startsWith('image/') || /\.(webp|png|jpe?g|gif)$/i.test(name)
    ? 'image'
    : 'raw';
}

/**
 * 生成浏览器直传 R2 的预签名 PUT 地址。
 * 由服务端校验目录、文件名、大小、类型与重名，签名只允许写入指定 key。
 * R2 未配置（本地开发）时返回 configured=false，由前端回退到服务端上传。
 */
export async function createUploadPresigns(input: {
  dir: string;
  files: PresignUploadInput[];
}): Promise<
  ActionResponse<{ configured: boolean; items: PresignUploadItem[] }>
> {
  return withActionPermission('files:upload', async (user) => {
    try {
      const relativePath = normalizeRelativePath(input.dir ?? '');
      const files = input.files ?? [];

      if (files.length === 0) {
        return { success: false, error: '没有提供文件' };
      }
      if (files.length > MAX_FILES_COUNT) {
        return {
          success: false,
          error: `文件数量超过限制，最多允许 ${MAX_FILES_COUNT} 个文件`,
        };
      }

      const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
      if (totalSize > MAX_TOTAL_SIZE) {
        return {
          success: false,
          error: `文件总大小超过限制，最多允许 ${MAX_TOTAL_SIZE / 1024 / 1024}MB`,
        };
      }

      const configured = isR2Configured();
      const usedKeys = new Set<string>();
      const items: PresignUploadItem[] = [];

      for (const file of files) {
        const name = file.name ?? '';
        try {
          if (!name) throw new Error('文件名不能为空');
          if (!Number.isFinite(file.size) || file.size <= 0) {
            throw new Error('文件内容为空');
          }
          if (file.size > MAX_FILE_SIZE) {
            throw new Error(
              `文件大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB`
            );
          }

          const fileName = sanitizeFileName(name);
          const target = deriveUploadTarget(name, file.type);
          const contentType = file.type || 'application/octet-stream';
          if (!isUploadMimeAllowed(contentType, fileName, target)) {
            throw new Error('不支持的文件类型');
          }

          const prefix = `uploads/${relativePath ? `${relativePath}/` : ''}`;
          const key = resolveUploadKey(`${prefix}${fileName}`);
          if (usedKeys.has(key)) {
            throw new Error(`文件名重复: ${fileName}`);
          }
          usedKeys.add(key);

          if (await uploadFileExists(key)) {
            throw new Error(`文件 ${fileName} 已存在`);
          }
          // 图片会额外生成同名 .webp，提前拦截冲突
          if (target === 'image' && !fileName.toLowerCase().endsWith('.webp')) {
            const webpName = `${fileName.replace(/\.[^/.]+$/, '') || 'upload'}.webp`;
            const webpKey = resolveUploadKey(`${prefix}${webpName}`);
            if (webpKey !== key && (await uploadFileExists(webpKey))) {
              throw new Error(`文件 ${webpName} 已存在`);
            }
          }

          if (!configured) {
            items.push({ name });
            continue;
          }

          const uploadUrl = await presignR2PutUrl(key, contentType);
          items.push({
            name,
            fileName,
            key,
            uploadUrl,
            contentType,
            target,
          });
        } catch (error) {
          items.push({
            name,
            error: error instanceof Error ? error.message : '预签名失败',
          });
        }
      }

      logger.info('生成直传预签名', {
        count: files.length,
        relativePath,
        configured,
        userId: user.id,
      });

      return { success: true, data: { configured, items } };
    } catch (error) {
      logger.error('生成直传预签名失败', error);
      return { success: false, error: '获取上传地址失败' };
    }
  });
}

export interface FinalizeUploadInput {
  /** 安全化后的文件名（createUploadPresigns 返回） */
  fileName: string;
  /** 原始文件名，用于结果提示 */
  displayName?: string;
  target: 'image' | 'raw';
}

/**
 * 直传完成后收尾：校验对象、图片转 WebP，并返回与原上传接口一致的结果结构。
 */
export async function finalizeUploadPresigns(input: {
  dir: string;
  files: FinalizeUploadInput[];
}): Promise<
  ActionResponse<{ message: string; results: UploadFileResultItem[] }>
> {
  return withActionPermission('files:upload', async (user) => {
    try {
      if (!isR2Configured()) {
        return { success: false, error: 'R2 未配置，无法完成直传' };
      }

      const relativePath = normalizeRelativePath(input.dir ?? '');
      const files = input.files ?? [];
      if (files.length === 0) {
        return { success: false, error: '没有待处理文件' };
      }

      const prefix = `uploads/${relativePath ? `${relativePath}/` : ''}`;
      const results: UploadFileResultItem[] = [];

      for (const file of files) {
        const displayName = file.displayName || file.fileName;
        let key = '';
        try {
          if (file.target !== 'image' && file.target !== 'raw') {
            throw new Error('非法的上传类型');
          }

          const fileName = sanitizeFileName(file.fileName);
          key = resolveUploadKey(`${prefix}${fileName}`);

          const meta = await getUploadFileMeta(key);
          if (!meta) {
            throw new Error(`文件 ${fileName} 上传未完成`);
          }
          if (meta.size > MAX_FILE_SIZE) {
            throw new Error(
              `文件大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB`
            );
          }

          let data: { url: string; converted: boolean };

          if (file.target === 'image') {
            const buffer = await readUploadFile(key);
            const processed = await uploadAssetBuffer(fileName, buffer, {
              dir: relativePath,
              target: 'image',
              originalStored: true,
              declaredMime: meta.contentType,
            });
            data = { url: processed.url, converted: processed.converted };
          } else {
            if (!isUploadMimeAllowed(meta.contentType ?? '', fileName, 'raw')) {
              throw new Error(`不支持的文件类型: ${fileName}`);
            }
            data = {
              url: `/uploads/${prefix.replace(/^uploads\//, '')}${fileName}`,
              converted: false,
            };
          }

          results.push({
            name: displayName,
            path: data.url,
            success: true,
            converted: data.converted,
          });
        } catch (error) {
          // 收尾失败时清掉直传对象，避免留下半成品并让用户可以直接重试
          if (key) {
            await deleteUploadFile(key).catch(() => {});
          }
          results.push({
            name: displayName,
            path: '',
            success: false,
            error: error instanceof Error ? error.message : '处理失败',
          });
        }
      }

      const successCount = results.filter((item) => item.success).length;
      const failCount = results.length - successCount;

      logger.info('直传收尾完成', {
        count: files.length,
        relativePath,
        successCount,
        failCount,
        userId: user.id,
      });

      return {
        success: true,
        data: {
          message: `上传完成: ${successCount} 成功, ${failCount} 失败`,
          results,
        },
      };
    } catch (error) {
      logger.error('直传收尾失败', error);
      return { success: false, error: '上传收尾失败' };
    }
  });
}

// GET - 获取文件列表
export async function adminGetUploadFiles(
  relativePath?: string
): Promise<ActionResponse<FileListResponse>> {
  return withActionPermission('files:read', async (user) => {
    let finalRelativePath = relativePath;

    if (finalRelativePath === undefined && user.id) {
      const cachedPath = pathCacheStore.get(user.id);
      finalRelativePath = cachedPath !== null ? cachedPath : '';
    } else if (finalRelativePath === undefined) {
      finalRelativePath = '';
    }

    try {
      const normalizedPath = normalizeRelativePath(finalRelativePath);
      const entries = await listUploadEntries(toAbsoluteDir(normalizedPath));

      const items: FileItem[] = entries
        .map((entry) => ({
          name: entry.name,
          path: toLogicalPath(normalizedPath, entry.name),
          type: entry.type,
          size: entry.size,
          lastUpdated: entry.lastModified.toISOString(),
          extension: entry.type === 'file' ? entry.extension : undefined,
        }))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      return {
        success: true,
        data: {
          items,
          currentPath: normalizedPath,
          breadcrumb: normalizedPath ? normalizedPath.split('/') : [],
        },
      };
    } catch (error) {
      logger.error('获取文件列表失败', error, { relativePath });
      return { success: false, error: '获取文件列表失败' };
    }
  });
}

// 创建文件夹
export async function createFolder(
  relativePath: string,
  folderName: string
): Promise<ActionResponse<{ folderName: string; message: string }>> {
  return withActionPermission('files:manageFolder', async (user) => {
    try {
      const dir = normalizeRelativePath(relativePath);
      const name = assertValidName(folderName, '文件夹名称');
      const key = resolveUploadKey(`uploads/${dir ? `${dir}/` : ''}${name}`);

      if ((await uploadFileExists(key)) || (await isUploadDirectory(key))) {
        return { success: false, error: `文件夹 ${name} 已存在` };
      }

      await createUploadDirectory(key);
      logger.info('创建文件夹成功', {
        relativePath: dir,
        folderName: name,
        userId: user.id,
      });
      return {
        success: true,
        data: { folderName: name, message: '创建成功' },
      };
    } catch (error) {
      logger.error('创建文件夹失败', error, { relativePath, folderName });
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建文件夹失败',
      };
    }
  });
}

// 删除文件 / 文件夹
export async function deleteFile(
  filePath: string
): Promise<ActionResponse<{ message: string }>> {
  return withActionPermission('files:delete', async (user) => {
    try {
      const key = resolveUploadKey(filePath);
      if (await isUploadDirectory(key)) {
        await deleteUploadDirectory(key);
      } else if (await uploadFileExists(key)) {
        await deleteUploadFile(key);
      } else {
        return { success: false, error: '文件不存在' };
      }

      logger.info('删除文件成功', { filePath, userId: user.id });
      return { success: true, data: { message: '删除成功' } };
    } catch (error) {
      logger.error('删除失败', error, { filePath });
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除失败',
      };
    }
  });
}

// 批量删除文件 / 文件夹（单条失败不影响其余项）
export async function deleteFiles(filePaths: string[]): Promise<
  ActionResponse<{
    deleted: string[];
    failed: { path: string; error: string }[];
  }>
> {
  return withActionPermission('files:delete', async (user) => {
    const deleted: string[] = [];
    const failed: { path: string; error: string }[] = [];

    for (const filePath of filePaths) {
      try {
        const key = resolveUploadKey(filePath);
        if (await isUploadDirectory(key)) {
          await deleteUploadDirectory(key);
        } else if (await uploadFileExists(key)) {
          await deleteUploadFile(key);
        } else {
          throw new Error('文件不存在');
        }
        deleted.push(filePath);
      } catch (error) {
        failed.push({
          path: filePath,
          error: error instanceof Error ? error.message : '删除失败',
        });
      }
    }

    logger.info('批量删除完成', {
      total: filePaths.length,
      deleted: deleted.length,
      failed: failed.length,
      userId: user.id,
    });

    return { success: true, data: { deleted, failed } };
  });
}

// 重命名文件 / 文件夹
export async function renameFile(
  oldPath: string,
  newName: string
): Promise<ActionResponse<{ message: string; newName: string }>> {
  return withActionPermission('files:update', async (user) => {
    try {
      const name = assertValidName(newName, '新名称');
      const key = resolveUploadKey(oldPath);

      const isDirectory = await isUploadDirectory(key);
      if (!isDirectory && !(await uploadFileExists(key))) {
        return { success: false, error: '文件不存在' };
      }

      const parent = key.slice(0, key.lastIndexOf('/'));
      const targetKey = `${parent}/${name}`;
      if (
        (await uploadFileExists(targetKey)) ||
        (await isUploadDirectory(targetKey))
      ) {
        return { success: false, error: `文件 ${name} 已存在` };
      }

      await renameUploadEntry(key, name);
      logger.info('重命名文件成功', {
        oldPath,
        newName: name,
        userId: user.id,
      });
      return { success: true, data: { message: '重命名成功', newName: name } };
    } catch (error) {
      logger.error('重命名失败', error, { oldPath, newName });
      return {
        success: false,
        error: error instanceof Error ? error.message : '重命名失败',
      };
    }
  });
}

// 缓存用户当前路径（Next.js 内存缓存，不涉及文件操作）
export async function cacheUploadPath(
  pathValue: string
): Promise<ActionResponse<void>> {
  return withActionPermission('files:read', async (user) => {
    try {
      if (user.id) {
        pathCacheStore.update(user.id, pathValue);
      }
      return { success: true, data: undefined };
    } catch (error) {
      logger.error('缓存路径失败', error, { path: pathValue });
      return { success: false, error: '缓存路径失败' };
    }
  });
}
