'use client';

import { File as FileIcon, Folder, Image } from 'lucide-react';
import type { FileItem } from './types';
import { isImage } from './upload-utils';

/**
 * 列表首列的缩略图。
 * 图片文件用浏览器原生懒加载渲染缩略图，点击后只把当前这张图传给全局预览组件。
 */
export function Thumbnail({ item }: { item: FileItem }) {
  if (item.type === 'directory') {
    return <Folder className="h-6 w-6 text-blue-500" />;
  }

  if (!isImage(item)) {
    return <FileIcon className="h-6 w-6 text-gray-500" />;
  }

  return <Image className="h-6 w-6 text-blue-500" />;
}
