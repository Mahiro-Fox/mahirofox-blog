'use client';

import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shadcn-ui/alert-dialog';
import { Button } from '@/components/shadcn-ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn-ui/dialog';
import { Input } from '@/components/shadcn-ui/input';
import type { FileItem } from './types';

interface NewFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  isCreating: boolean;
  onCreate: () => void;
}

/** 新建文件夹对话框 */
export function NewFolderDialog({
  open,
  onOpenChange,
  value,
  onValueChange,
  isCreating,
  onCreate,
}: NewFolderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建文件夹</DialogTitle>
          <DialogDescription>在当前目录下创建新文件夹</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder="文件夹名称"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            取消
          </Button>
          <Button onClick={onCreate} disabled={isCreating || !value.trim()}>
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedName?: string;
  value: string;
  onValueChange: (value: string) => void;
  isRenaming: boolean;
  onRename: () => void;
}

/** 重命名对话框 */
export function RenameDialog({
  open,
  onOpenChange,
  selectedName,
  value,
  onValueChange,
  isRenaming,
  onRename,
}: RenameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>重命名</DialogTitle>
          <DialogDescription>
            将 &quot;{selectedName}&quot; 重命名为：
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder="新名称"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRenaming}
          >
            取消
          </Button>
          <Button onClick={onRename} disabled={isRenaming || !value.trim()}>
            {isRenaming ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItem: FileItem | null;
  onConfirm: () => void;
}

/** 删除确认对话框 */
export function DeleteFileDialog({
  open,
  onOpenChange,
  selectedItem,
  onConfirm,
}: DeleteFileDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除?</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除 &quot;{selectedItem?.name}&quot; 吗？
            {selectedItem?.type === 'directory' &&
              ' 该文件夹内的所有内容将被一并删除。'}
            此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-white"
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
