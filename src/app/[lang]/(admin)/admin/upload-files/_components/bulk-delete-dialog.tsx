'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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

const CONFIRM_TEXT = 'delete';

interface BulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderCount: number;
  fileCount: number;
  isDeleting: boolean;
  onConfirm: () => void;
}

/** 批量删除确认对话框：需要输入 delete 才能继续 */
export function BulkDeleteDialog({
  open,
  onOpenChange,
  folderCount,
  fileCount,
  isDeleting,
  onConfirm,
}: BulkDeleteDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const canConfirm = confirmText === CONFIRM_TEXT;

  useEffect(() => {
    if (!open) setConfirmText('');
  }, [open]);

  const folderLabel = folderCount > 0 ? `${folderCount} 个文件夹` : '';
  const fileLabel = fileCount > 0 ? `${fileCount} 个文件` : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除?</DialogTitle>
          <DialogDescription>
            即将永久删除{folderLabel}
            {folderLabel && fileLabel ? '和' : ''}
            {fileLabel}
            {folderCount > 0 && '（文件夹内的所有内容将一并删除）'}，此操作无法撤销。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          <p className="text-muted-foreground text-sm">
            请输入 <code className="bg-muted rounded px-1 py-0.5">{CONFIRM_TEXT}</code>{' '}
            以确认删除：
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_TEXT}
            autoFocus
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!canConfirm || isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
