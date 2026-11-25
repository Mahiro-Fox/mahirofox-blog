export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  lastUpdated: string;
  extension?: string;
}

export interface FileListResponse {
  items: FileItem[];
  currentPath: string;
  breadcrumb: string[];
  /** 下一页游标，undefined 表示已到末页 */
  nextCursor?: string;
}

export interface UploadFilesClientProps {
  initialData: FileListResponse;
}
