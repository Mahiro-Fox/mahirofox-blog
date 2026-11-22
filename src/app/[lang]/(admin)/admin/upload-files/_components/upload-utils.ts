import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_FILES_COUNT,
  MAX_TOTAL_SIZE,
} from '@/constant';
import { toast } from 'sonner';
import {
  adminUploadFiles,
  createUploadPresigns,
  finalizeUploadPresigns,
  type FinalizeUploadInput,
} from '@/actions/admin/upload-files-actions';
import type { FileItem } from './types';

// 图片扩展名（不含点，与 FileItem.extension 的格式保持一致）
const IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'avif',
  'ico',
];

// 是否是图片文件
export const isImage = (item: FileItem) => {
  if (item.type !== 'file') return false;
  const extension = (item.extension || '').replace(/^\./, '').toLowerCase();
  return IMAGE_EXTENSIONS.includes(extension);
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
        `文件 ${file.name} 超过单文件限制 (${MAX_FILE_SIZE / 1024 / 1024}MB)`
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
      `文件总大小超过限制，最多允许 ${MAX_TOTAL_SIZE / 1024 / 1024}MB`
    );
    return false;
  }

  if (validationErrors.length > 0) {
    validationErrors.forEach((err) => toast.error(err));
    return false;
  }

  return true;
};

// 服务端中转上传（R2 未配置时回退，本地开发可用）
const uploadViaServerAction = async (path: string, files: FileList) => {
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

  showResultToasts(result.data?.results ?? []);
};

// 汇总结果提示
const showResultToasts = (
  results: { name: string; success: boolean; error?: string }[]
) => {
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  if (failCount === 0) {
    toast.success(`成功上传 ${successCount} 个文件`);
  } else {
    toast.warning(`${successCount} 成功, ${failCount} 失败`);
    results
      .filter((r) => !r.success)
      .forEach((r) => toast.error(`${r.name}: ${r.error ?? '未知错误'}`));
  }
};

/**
 * 上传文件：优先走浏览器 → R2 预签名直传（绕过 Cloudflare 对请求体的 WAF 扫描），
 * R2 未配置时回退到 Server Action 中转。
 */
export const uploadFiles = async (path: string, files: FileList) => {
  const list = Array.from(files);

  const presign = await createUploadPresigns({
    dir: path,
    files: list.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    })),
  });

  if (!presign.success) {
    toast.error(presign.error || '上传失败');
    return;
  }

  if (!presign.data.configured) {
    await uploadViaServerAction(path, files);
    return;
  }

  const items = presign.data.items;
  const errors: string[] = [];
  const finalizeFiles: FinalizeUploadInput[] = [];

  await Promise.all(
    items.map(async (item, index) => {
      const file = list[index];
      if (item.error || !item.uploadUrl || !item.fileName || !item.target) {
        errors.push(`${item.name}: ${item.error ?? '获取上传地址失败'}`);
        return;
      }

      try {
        const response = await fetch(item.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': item.contentType ?? 'application/octet-stream',
          },
          body: file,
        });
        if (!response.ok) {
          throw new Error(`上传失败 (HTTP ${response.status})`);
        }
        finalizeFiles.push({
          fileName: item.fileName,
          displayName: item.name,
          target: item.target,
        });
      } catch (error) {
        errors.push(
          `${item.name}: ${error instanceof Error ? error.message : '上传失败'}`
        );
      }
    })
  );

  let successCount = 0;
  let failCount = errors.length;

  if (finalizeFiles.length > 0) {
    const finalResult = await finalizeUploadPresigns({
      dir: path,
      files: finalizeFiles,
    });

    if (!finalResult.success) {
      toast.error(finalResult.error || '上传处理失败');
      failCount += finalizeFiles.length;
    } else {
      const results = finalResult.data.results;
      successCount = results.filter((r) => r.success).length;
      failCount += results.length - successCount;
      results
        .filter((r) => !r.success)
        .forEach((r) => errors.push(`${r.name}: ${r.error ?? '未知错误'}`));
    }
  }

  if (failCount === 0) {
    toast.success(`成功上传 ${successCount} 个文件`);
  } else {
    toast.warning(`${successCount} 成功, ${failCount} 失败`);
    errors.forEach((message) => toast.error(message));
  }
};
