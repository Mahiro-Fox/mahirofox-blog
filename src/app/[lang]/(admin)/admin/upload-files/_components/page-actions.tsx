'use client';

import { FolderPlus, ImageDown, Loader2, Upload } from 'lucide-react';

interface PageActionsConfig {
  isConverting: boolean;
  isUploading: boolean;
  onNewFolder: () => void;
  onConvert: () => void;
  onUpload: () => void;
}

/** AdminPageLayout 顶部操作 */
export const buildPageActions = ({
  isConverting,
  isUploading,
  onNewFolder,
  onConvert,
  onUpload,
}: PageActionsConfig) => [
  {
    label: '新建文件夹',
    icon: <FolderPlus className="mr-2 h-4 w-4" />,
    onClick: onNewFolder,
    variant: 'outline' as const,
  },
  {
    label: 'PNG 转 WebP',
    icon: isConverting ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : (
      <ImageDown className="mr-2 h-4 w-4" />
    ),
    onClick: onConvert,
    variant: 'outline' as const,
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
    variant: 'default' as const,
    disabled: isUploading,
  },
];
