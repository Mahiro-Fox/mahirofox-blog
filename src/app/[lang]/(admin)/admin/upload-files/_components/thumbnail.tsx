'use client';

import { File as FileIcon, Folder } from 'lucide-react';
import NextImage from 'next/image';
import { useImagePreview } from '@/context/image-preview-provider';
import { isImage } from './upload-utils';
import type { FileItem } from './types';

/**
 * 列表首列的缩略图。
 * 图片文件用浏览器原生懒加载渲染缩略图，点击后只把当前这张图传给全局预览组件。
 */
export function Thumbnail({ item }: { item: FileItem }) {
  const { open } = useImagePreview();

  if (item.type === 'directory') {
    return <Folder className="h-6 w-6 text-blue-500" />;
  }

  if (!isImage(item)) {
    return <FileIcon className="h-6 w-6 text-gray-500" />;
  }

  return (
    <button
      type="button"
      title="点击预览"
      aria-label={`预览 ${item.name}`}
      className="bg-muted block h-10 w-10 cursor-zoom-in overflow-hidden rounded border transition-opacity hover:opacity-80"
      onClick={(e) => {
        e.stopPropagation();
        open([{ src: item.path, alt: item.name }]);
      }}
    >
      <NextImage
        src={item.path}
        alt={item.name}
        width={40}
        height={40}
        unoptimized
        loading="lazy"
        className="h-10 w-10 object-cover"
      />
    </button>
  );
}
