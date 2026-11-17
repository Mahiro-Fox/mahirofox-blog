'use client';

import { useImagePreview } from '@/context/image-preview-provider';
import { Check, Copy, ImageIcon, Minus, Trash2 } from 'lucide-react';
import { Button } from '@/components/shadcn-ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn-ui/table';
import { formatDate, formatSize } from '@/utils/utils';
import { Thumbnail } from './thumbnail';
import type { FileItem } from './types';
import { copyPath, isImage } from './upload-utils';

interface SelectionCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: () => void;
}

/** 统一样式的选择框（原生 input + 叠加图标，支持半选） */
function SelectionCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: SelectionCheckboxProps) {
  return (
    <span className="relative inline-flex items-center justify-center">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={onChange}
        className="peer border-input bg-background checked:border-primary checked:bg-primary focus-visible:ring-ring/50 h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-lg border shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
      />
      {indeterminate ? (
        <Minus
          className="text-primary-foreground pointer-events-none absolute h-3 w-3"
          strokeWidth={3}
        />
      ) : (
        <Check
          className="text-primary-foreground pointer-events-none absolute h-3 w-3 opacity-0 transition-opacity peer-checked:opacity-100"
          strokeWidth={3}
        />
      )}
    </span>
  );
}

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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <SelectionCheckbox
              label="全选"
              checked={allSelected}
              indeterminate={partiallySelected}
              onChange={onToggleSelectAll}
            />
          </TableHead>
          <TableHead>预览</TableHead>
          <TableHead>名称</TableHead>
          <TableHead>路径</TableHead>
          <TableHead>大小</TableHead>
          <TableHead>更新时间</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={7}
              className="text-muted-foreground py-8 text-center"
            >
              暂无文件
            </TableCell>
          </TableRow>
        ) : (
          items.map((item) => (
            <TableRow
              key={item.name}
              data-state={
                selectedPaths.includes(item.path) ? 'selected' : undefined
              }
              className={
                item.type === 'directory'
                  ? 'hover:bg-muted/50 cursor-pointer'
                  : ''
              }
              onClick={() => item.type === 'directory' && onEnterFolder(item)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <SelectionCheckbox
                  label={`选择 ${item.name}`}
                  checked={selectedPaths.includes(item.path)}
                  onChange={() => onToggleSelect(item.path)}
                />
              </TableCell>
              <TableCell>
                <Thumbnail item={item} />
              </TableCell>
              <TableCell className="max-w-20 overflow-hidden font-medium text-ellipsis">
                {item.name}
              </TableCell>
              <TableCell>
                <button
                  type="button"
                  className="bg-muted cursor-pointer rounded px-2 py-1 font-mono text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyPath(item.path);
                  }}
                  title="点击复制"
                >
                  {item.path}
                </button>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {item.type === 'directory' ? '-' : formatSize(item.size)}
              </TableCell>
              <TableCell>
                {item.type === 'directory' ? '-' : formatDate(item.lastUpdated)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {item.type === 'file' && isImage(item) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        open([{ src: item.path, alt: item.name }]);
                      }}
                    >
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRename(item);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
