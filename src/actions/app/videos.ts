'use server';

import { VRCHAT_VIDEO_DIR } from '@/constant/dir';
import { getVideosPage, type VideoItem } from '@/lib/videos';

export interface VideosResponse {
  videos: VideoItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

/** 分页读取 R2 上的视频列表，供录像墙无限滚动使用 */
export async function getVideosAction(
  page: number = 1,
  limit: number = 24
): Promise<VideosResponse> {
  if (page < 1 || limit < 1 || limit > 60) {
    throw new Error('Invalid pagination parameters');
  }

  const { videos, total } = await getVideosPage(VRCHAT_VIDEO_DIR, page, limit);

  return {
    videos,
    pagination: {
      page,
      limit,
      total,
      hasMore: page * limit < total,
    },
  };
}
