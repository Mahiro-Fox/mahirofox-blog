'use client';

import { useImagePreview } from '@/context/image-preview-provider';
import { Eye, FilePenLine, Trash2 } from 'lucide-react';
import { DataTable, type Column } from '@/components/admin/data-table';
import { Button } from '@/components/shadcn-ui/button';
import { SelectionCheckbox } from '@/components/shared/selection-check-box';
import { cn, formatDate, formatSize } from '@/utils/utils';
import { Thumbnail } from './thumbnail';
import type { FileItem } from './types';
import { copyPath, isImage } from './upload-utils';

interface FileTableProps {
  items: FileItem[];
  selectedPaths: string[];
  onToggleSelect: (path: string) => void;
  onToggleSelectAll: () => void;
  onEnterFolder: (item: FileItem) => void;
  onRename: (item: FileItem) => void;
  onDelete: (item: FileItem) => void;
}

/** 文件列表表格 */
export function FileTable({
  items,
  selectedPaths,
  onToggleSelect,
  onToggleSelectAll,
  onEnterFolder,
  onRename,
  onDelete,
}: FileTableProps) {
  const { open } = useImagePreview();
  const allSelected = items.length > 0 && selectedPaths.length === items.length;
  const partiallySelected = selectedPaths.length > 0 && !allSelected;

  const columns: Column<FileItem>[] = [
    {
      key: 'select',
      width: 'w-10',
      header: (
        <SelectionCheckbox
          label="全选"
          checked={allSelected}
          indeterminate={partiallySelected}
          onChange={onToggleSelectAll}
        />
      ),
      render: (item) => (
        <div onClick={(event) => event.stopPropagation()}>
          <SelectionCheckbox
            label={`选择 ${item.name}`}
            checked={selectedPaths.includes(item.path)}
            onChange={() => onToggleSelect(item.path)}
          />
        </div>
      ),
    },
    {
      key: 'thumbnail',
      header: '预览',
      render: (item) => <Thumbnail item={item} />,
    },
    {
      key: 'name',
      header: '名称',
      render: (item) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'path',
      header: '路径',
      width: 'max-w-xl',
      render: (item) => (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-6 justify-start rounded px-2 font-mono text-xs"
          onClick={(event) => {
            event.stopPropagation();
            copyPath(item.path);
          }}
          title="点击复制"
        >
          {item.path}
        </Button>
      ),
    },
    {
      key: 'size',
      header: '大小',
      render: (item) => (
        <span className="text-muted-foreground">
          {item.type === 'directory' ? '-' : formatSize(item.size)}
        </span>
      ),
    },
    {
      key: 'lastUpdated',
      header: '更新时间',
      render: (item) =>
        item.type === 'directory' ? '-' : formatDate(item.lastUpdated),
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      render: (item) => (
        <div className="flex justify-end gap-2">
          {item.type === 'file' && isImage(item) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(event) => {
                event.stopPropagation();
                open([{ src: item.path, alt: item.name }]);
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => {
              event.stopPropagation();
              onRename(item);
            }}
          >
            <FilePenLine className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(item);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={items}
      columns={columns}
      emptyText="暂无文件"
      keyExtractor={(item) => item.path}
      virtual={true}
      virtualOptions={{
        estimateSize: 50,
        maxHeight: '65vh',
      }}
      rowProps={(item) => ({
        className: cn(
          item.type === 'directory' && 'cursor-pointer',
          selectedPaths.includes(item.path) && 'bg-muted'
        ),
        onClick:
          item.type === 'directory' ? () => onEnterFolder(item) : undefined,
      })}
    />
  );
}
