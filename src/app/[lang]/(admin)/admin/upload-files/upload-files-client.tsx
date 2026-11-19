'use client';

import { toast } from 'sonner';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminGetUploadFiles,
  cacheUploadPath,
  createFolder,
  deleteFile,
  deleteFiles,
  renameFile,
} from '@/actions/admin/upload-files-actions';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { Input } from '@/components/shadcn-ui/input';
import { BreadcrumbNav } from './_components/breadcrumb-nav';
import { BulkDeleteDialog } from './_components/bulk-delete-dialog';
import {
  DeleteFileDialog,
  NewFolderDialog,
  RenameDialog,
} from './_components/file-dialogs';
import { FileTable } from './_components/file-table';
import { buildPageActions } from './_components/page-actions';
import type {
  FileItem,
  FileListResponse,
  UploadFilesClientProps,
} from './_components/types';
import {
  uploadFiles,
  validateUploadSelection,
} from './_components/upload-utils';

export default function UploadFilesClient({
  initialData,
}: UploadFilesClientProps) {
  const [currentPath, setCurrentPath] = useState(initialData.currentPath);
  const [data, setData] = useState<FileListResponse>(initialData);
  const hasMountedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // 获取文件列表
  const fetchFiles = useCallback(async (path: string = '') => {
    try {
      setLoading(true);
      const result = await adminGetUploadFiles(path);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        if (!result.success) {
          toast.error(result.error || '获取文件列表失败');
        }
      }
    } catch {
      toast.error('获取文件列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    fetchFiles(currentPath);
  }, [currentPath, fetchFiles]);

  // 缓存当前路径到服务端
  useEffect(() => {
    let isMounted = true;

    const cachePath = async () => {
      const result = await cacheUploadPath(currentPath);
      if (!result.success && isMounted) {
        console.error('缓存路径失败:', result.error);
      }
    };

    cachePath();

    return () => {
      isMounted = false;
    };
  }, [currentPath]);

  // 进入文件夹
  const enterFolder = (folder: FileItem) => {
    if (folder.type === 'directory') {
      const newPath = currentPath
        ? `${currentPath}/${folder.name}`
        : folder.name;
      setSelectedPaths([]);
      setCurrentPath(newPath);
    }
  };

  // 返回上级目录
  const goBack = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    setSelectedPaths([]);
    setCurrentPath(parts.join('/'));
  };

  // 点击面包屑跳转
  const navigateToBreadcrumb = (index: number) => {
    if (!data) return;
    const parts = data.breadcrumb.slice(0, index + 1);
    setSelectedPaths([]);
    setCurrentPath(parts.join('/'));
  };

  // 新建文件夹
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    setIsCreatingFolder(true);
    try {
      const result = await createFolder(currentPath, newFolderName.trim());

      if (result.success) {
        toast.success('文件夹创建成功');
        setIsNewFolderDialogOpen(false);
        setNewFolderName('');
        await fetchFiles(currentPath);
      } else {
        toast.error(result.error || '创建失败');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // 上传文件
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    // 前端验证
    if (!validateUploadSelection(selectedFiles)) {
      e.target.value = '';
      return;
    }

    setIsUploading(true);

    try {
      await uploadFiles(currentPath, selectedFiles);
      fetchFiles(currentPath);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传失败');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // 删除文件/文件夹
  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      const result = await deleteFile(selectedItem.path);

      if (result.success) {
        toast.success(
          selectedItem.type === 'directory' ? '文件夹删除成功' : '文件删除成功'
        );
        setIsDeleteDialogOpen(false);
        setSelectedItem(null);
        fetchFiles(currentPath);
      } else {
        toast.error(result.error || '删除失败');
      }
    } catch {
      toast.error('删除失败');
    }
  };

  // 重命名
  const handleRename = async () => {
    if (!selectedItem || !newName.trim()) return;

    setIsRenaming(true);
    try {
      const result = await renameFile(selectedItem.path, newName.trim());

      if (result.success) {
        toast.success('重命名成功');
        setIsRenameDialogOpen(false);
        setNewName('');
        fetchFiles(currentPath);
      } else {
        toast.error(result.error || '重命名失败');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '重命名失败');
    } finally {
      setIsRenaming(false);
    }
  };

  // 打开重命名对话框
  const openRenameDialog = (item: FileItem) => {
    setSelectedItem(item);
    setNewName(item.name);
    setIsRenameDialogOpen(true);
  };

  // 多选
  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) =>
      prev.includes(path)
        ? prev.filter((item) => item !== path)
        : [...prev, path]
    );
  };

  const toggleSelectAll = () => {
    setSelectedPaths((prev) =>
      prev.length === items.length ? [] : items.map((item) => item.path)
    );
  };

  // 批量删除
  const handleBulkDelete = async () => {
    if (selectedPaths.length === 0) return;

    setIsBulkDeleting(true);
    try {
      const result = await deleteFiles(selectedPaths);

      if (result.success && result.data) {
        const { deleted, failed } = result.data;
        if (failed.length === 0) {
          toast.success(`已删除 ${deleted.length} 项`);
        } else {
          toast.warning(
            `${deleted.length} 项删除成功, ${failed.length} 项失败`
          );
          failed.forEach((item) => toast.error(`${item.path}: ${item.error}`));
        }
        setIsBulkDeleteOpen(false);
        setSelectedPaths([]);
        fetchFiles(currentPath);
      } else if (!result.success) {
        toast.error(result.error || '删除失败');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const items = data?.items || [];
  const selectedItems = items.filter((item) =>
    selectedPaths.includes(item.path)
  );
  const selectedFolderCount = selectedItems.filter(
    (item) => item.type === 'directory'
  ).length;
  const selectedFileCount = selectedItems.length - selectedFolderCount;

  const actions = buildPageActions({
    isUploading,
    selectedFolderCount,
    selectedFileCount,
    onNewFolder: () => setIsNewFolderDialogOpen(true),
    onUpload: () => document.getElementById('file-upload')?.click(),
    onBulkDelete: () => setIsBulkDeleteOpen(true),
  });

  return (
    <>
      <AdminPageLayout
        title={
          <BreadcrumbNav
            currentPath={currentPath}
            breadcrumb={data?.breadcrumb ?? []}
            onGoBack={goBack}
            onHome={() => setCurrentPath('')}
            onNavigate={navigateToBreadcrumb}
          />
        }
        description={`文件列表 (${items.length})`}
        actions={actions}
        loading={loading}
      >
        <FileTable
          items={items}
          selectedPaths={selectedPaths}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onEnterFolder={enterFolder}
          onRename={openRenameDialog}
          onDelete={(item) => {
            setSelectedItem(item);
            setIsDeleteDialogOpen(true);
          }}
        />
      </AdminPageLayout>

      <Input
        type="file"
        onChange={handleUpload}
        disabled={isUploading}
        className="hidden"
        id="file-upload"
        multiple
      />

      <NewFolderDialog
        open={isNewFolderDialogOpen}
        onOpenChange={setIsNewFolderDialogOpen}
        value={newFolderName}
        onValueChange={setNewFolderName}
        isCreating={isCreatingFolder}
        onCreate={handleCreateFolder}
      />

      <RenameDialog
        open={isRenameDialogOpen}
        onOpenChange={setIsRenameDialogOpen}
        selectedName={selectedItem?.name}
        value={newName}
        onValueChange={setNewName}
        isRenaming={isRenaming}
        onRename={handleRename}
      />

      <DeleteFileDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        selectedItem={selectedItem}
        onConfirm={handleDelete}
      />

      <BulkDeleteDialog
        open={isBulkDeleteOpen}
        onOpenChange={setIsBulkDeleteOpen}
        folderCount={selectedFolderCount}
        fileCount={selectedFileCount}
        isDeleting={isBulkDeleting}
        onConfirm={handleBulkDelete}
      />
    </>
  );
}
