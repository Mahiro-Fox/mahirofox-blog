'use client';

import { FolderPlus, ImageDown, Loader2, Trash2, Upload } from 'lucide-react';
import type { PageAction } from '@/components/admin/admin-page-layout-actions';

interface PageActionsConfig {
  isConverting: boolean;
  isUploading: boolean;
  selectedFolderCount: number;
  selectedFileCount: number;
  onNewFolder: () => void;
  onConvert: () => void;
  onUpload: () => void;
  onBulkDelete: () => void;
}

/** 根据选中项拼装批量删除文案，如 Delete 1 folder and 2 files */
const buildBulkDeleteLabel = (
  folderCount: number,
  fileCount: number
): string =>
  [
    folderCount > 0
      ? `${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`
      : '',
    fileCount > 0 ? `${fileCount} ${fileCount === 1 ? 'file' : 'files'}` : '',
  ]
    .filter(Boolean)
    .join(' and ');

/** AdminPageLayout 顶部操作 */
export const buildPageActions = ({
  isConverting,
  isUploading,
  selectedFolderCount,
  selectedFileCount,
  onNewFolder,
  onConvert,
  onUpload,
  onBulkDelete,
}: PageActionsConfig): PageAction[] => {
  const actions: PageAction[] = [];

  // 有选中项时才动态插入批量删除按钮
  if (selectedFolderCount + selectedFileCount > 0) {
    actions.push({
      label: `Delete ${buildBulkDeleteLabel(selectedFolderCount, selectedFileCount)}`,
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: onBulkDelete,
      variant: 'destructive',
    });
  }

  actions.push(
    {
      label: '新建文件夹',
      icon: <FolderPlus className="mr-2 h-4 w-4" />,
      onClick: onNewFolder,
      variant: 'outline',
    },
    {
      label: 'PNG 转 WebP',
      icon: isConverting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <ImageDown className="mr-2 h-4 w-4" />
      ),
      onClick: onConvert,
      variant: 'outline',
      disabled: isConverting,
    },
    {
      label: '上传文件',
      icon: isUploading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Upload className="mr-2 h-4 w-4" />
      ),
      onClick: onUpload,
      variant: 'default',
      disabled: isUploading,
    }
  );

  return actions;
};
