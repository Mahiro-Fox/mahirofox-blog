import {
  listUploadFiles,
  toUploadUrl,
  type UploadEntry,
} from '@/lib/server/uploads';

/**
 * 视频资源读取层。
 *
 * 与 photos 一致：配置了 R2 时读 uploads/videos/ 前缀，未配置时退回本地目录。
 * 视频不做转码/探测，列表只拿文件名、体积与修改时间，
 * 时长由前端 <video> 加载元数据后自行读取。
 */

/** 常见可直接播放的容器格式 */
export const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];

export interface VideoItem {
  /** 可直接给 <video src> 的逻辑路径（/uploads/videos/xxx.mp4） */
  src: string;
  filename: string;
  size: number;
  lastModifiedAt: string;
}

export interface VideoPage {
  videos: VideoItem[];
  /** 目录下视频总数 */
  total: number;
}

/** 按最后修改时间倒序，最新的在前 */
function sortByLatest(entries: UploadEntry[]): UploadEntry[] {
  return [...entries].sort(
    (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
  );
}

function toVideoItem(entry: UploadEntry): VideoItem {
  return {
    src: toUploadUrl(entry.key),
    filename: entry.name,
    size: entry.size,
    lastModifiedAt: entry.lastModified.toISOString(),
  };
}

/** 分页读取视频列表（ListObjectsV2 只列一次，不做任何下载） */
export async function getVideosPage(
  dir: string,
  page = 1,
  limit = 24
): Promise<VideoPage> {
  const files = sortByLatest(await listUploadFiles(dir, VIDEO_EXTENSIONS));
  const start = Math.max(0, (page - 1) * limit);

  return {
    videos: files.slice(start, start + limit).map(toVideoItem),
    total: files.length,
  };
}
