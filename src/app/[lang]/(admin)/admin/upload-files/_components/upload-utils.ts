import { toast } from 'sonner';
import { adminUploadFiles } from '@/actions/admin/upload-files-actions';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_FILES_COUNT,
  MAX_TOTAL_SIZE,
} from '@/constant/file-upload';
import type { FileItem } from './types';

const IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.avif',
  '.ico',
];

// 是否是图片文件
export const isImage = (item: FileItem) => {
  if (item.type !== 'file') return false;
  return IMAGE_EXTENSIONS.includes(item.extension || '');
};

// 复制路径到剪贴板
export const copyPath = (path: string) => {
  navigator.clipboard.writeText(path);
  toast.success('路径已复制');
};

// 前端验证上传文件（数量与大小分开处理）
export const validateFiles = (
  files: FileList
): { totalSize: number; errors: string[] } => {
  let totalSize = 0;
  const errors: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    totalSize += file.size;

    if (file.size > MAX_FILE_SIZE) {
      errors.push(
        `文件 ${file.name} 超过单文件限制 (${MAX_FILE_SIZE / (1024 * 1024)}MB)`
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      errors.push(`不支持的文件类型: ${file.name}`);
    }
  }

  return { totalSize, errors };
};

// 上传前校验（数量/总大小/单文件/类型），失败时返回 false
export const validateUploadSelection = (files: FileList): boolean => {
  if (files.length > MAX_FILES_COUNT) {
    toast.error(`文件数量超过限制，最多允许 ${MAX_FILES_COUNT} 个文件`);
    return false;
  }

  const { totalSize, errors: validationErrors } = validateFiles(files);

  if (totalSize > MAX_TOTAL_SIZE) {
    toast.error(
      `文件总大小超过限制，最多允许 ${MAX_TOTAL_SIZE / (1024 * 1024)}MB`
    );
    return false;
  }

  if (validationErrors.length > 0) {
    validationErrors.forEach((err) => toast.error(err));
    return false;
  }

  return true;
};

// 执行上传并处理结果提示（改为调用 Server Action，由 Next.js 内部带密钥转发给 Go）
export const uploadFiles = async (path: string, files: FileList) => {
  const formData = new FormData();
  formData.append('path', path);
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  const result = await adminUploadFiles(formData);

  if (!result.success) {
    toast.error(result.error || '上传失败');
    return;
  }

  const data = result.data;
  const results = data?.results || [];
  const successCount = results.filter(
    (r: { success: boolean }) => r.success
  ).length;
  const failCount = results.length - successCount;

  if (failCount === 0) {
    toast.success(`成功上传 ${successCount} 个文件`);
  } else {
    toast.warning(`${successCount} 成功, ${failCount} 失败`);
    results
      .filter((r: { success: boolean }) => !r.success)
      .forEach((r: { name: string; error?: string }) => {
        toast.error(`${r.name}: ${r.error ?? '未知错误'}`);
      });
  }
};
