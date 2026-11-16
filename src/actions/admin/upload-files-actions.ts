'use server';

import path from 'path';
import { UPLOADS_DIR } from '@/constant/dir';
import { uploadAssetFile } from '@/lib/server/asset-upload';
import {
  createUploadDirectory,
  deleteUploadDirectory,
  deleteUploadFile,
  isUploadDirectory,
  listUploadEntries,
  renameUploadEntry,
  resolveUploadKey,
  uploadFileExists,
} from '@/lib/server/uploads';
import { pathCacheStore } from '@/store/path-cache-store';
import {
  withActionPermission,
  type ActionResponse,
} from '@/utils/action-response';
import { createLogger } from '@/utils/logger';
import { convertImagesWebp } from '../../../scripts/convert-to-webp';

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
      const key = resolveUploadKey(
        `uploads/${dir ? `${dir}/` : ''}${name}`
      );

      if (
        (await uploadFileExists(key)) ||
        (await isUploadDirectory(key))
      ) {
        return { success: false, error: `文件夹 ${name} 已存在` };
      }

      await createUploadDirectory(key);
      logger.info('创建文件夹成功', { relativePath: dir, folderName: name, userId: user.id });
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
      logger.info('重命名文件成功', { oldPath, newName: name, userId: user.id });
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

// 批量转换图片为 WebP
export async function convertImages(): Promise<
  ActionResponse<{
    message: string;
    convertedFiles: string[];
    errorFiles: string[];
  }>
> {
  return withActionPermission('system:convertImages', async () => {
    const result = await convertImagesWebp();
    if (result.success) {
      return {
        success: true,
        message: '转换成功',
        data: {
          message: '转换成功',
          convertedFiles: result.data.success,
          errorFiles: result.data.failed,
        },
      };
    }

    return {
      success: false,
      error: '批量转换失败',
    };
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
