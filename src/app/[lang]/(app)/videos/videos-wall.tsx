'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getVideosAction } from '@/actions/app/videos';
import { useT } from '@/i18n/dictionary-provider';
import type { VideoItem } from '@/lib/content/videos';
import { formatDate } from '@/utils/utils';
import { VideoCard } from './video-card';
import { VideoLightbox } from './video-lightbox';

interface VideosWallProps {
  initialVideos: VideoItem[];
  initialHasMore: boolean;
}

const PAGE_SIZE = 24;

/**
 * 拼贴节奏：首个 2×3 作为焦点，之后每隔几块穿插横条与竖幅，
 * 配合 grid-flow-dense 让网格保持非对称。
 */
function spanClass(index: number): string {
  if (index === 0) return 'col-span-2 row-span-3';
  if (index % 9 === 4) return 'col-span-2 row-span-2';
  if (index % 6 === 3) return 'row-span-3';
  return 'row-span-2';
}

export function VideosWall({ initialVideos, initialHasMore }: VideosWallProps) {
  const t = useT();
  const [videos, setVideos] = useState(initialVideos);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const next = await getVideosAction(page + 1, PAGE_SIZE);
      setVideos((prev) => [...prev, ...next.videos]);
      setHasMore(next.pagination.hasMore);
      setPage(next.pagination.page);
    } catch {
      // 分页失败时停止继续触发，已加载内容保持可用
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, page]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void loadMore();
      },
      { rootMargin: '400px' }
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [loadMore]);

  const lastSync =
    videos.length > 0
      ? formatDate(videos[0].lastModifiedAt).replace(/\//g, '.')
      : '--';
  const activeVideo = activeIndex === null ? null : videos[activeIndex];

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      {/* 左侧竖排标识：桌面端吸顶，移动端压成一行 */}
      <aside className="lg:sticky lg:top-24 lg:h-fit lg:w-40 lg:shrink-0">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1 lg:flex-col lg:items-start">
          <p className="text-primary flex w-full items-center gap-1.5 font-mono text-[11px] font-medium tracking-[0.3em]">
            <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" />
            REC
          </p>
          <h1 className="text-3xl leading-none font-semibold tracking-tight">
            VRChat
          </h1>
          <p className="text-muted-foreground font-mono text-[11px] tracking-[0.3em]">
            {t('videos.records')}
          </p>
          {videos.length > 0 && (
            <dl className="text-muted-foreground mt-4 hidden space-y-1.5 font-mono text-[11px] tracking-[0.14em] lg:block">
              <div className="flex items-baseline gap-1.5">
                <dd className="text-foreground text-base leading-none">
                  {videos.length}
                </dd>
                <dt>{t('videos.clips')}</dt>
              </div>
              <div className="whitespace-nowrap">
                {t('videos.last_sync')} {lastSync}
              </div>
            </dl>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {videos.length === 0 ? (
          <div className="border-border flex min-h-[45vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
            <p className="text-muted-foreground font-mono text-xl tracking-[0.4em]">
              NO SIGNAL
            </p>
            <p className="text-muted-foreground text-sm">{t('videos.empty')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-flow-dense auto-rows-[72px] grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {videos.map((video, index) => (
                <VideoCard
                  key={video.src}
                  video={video}
                  index={index}
                  featured={index === 0}
                  // 行高由 auto-rows-[72px] 决定，与内容无关，
                  // 因此可以直接跳过屏外卡片的布局与绘制
                  className={`cv-auto ${spanClass(index)}`}
                  onOpen={() => setActiveIndex(index)}
                />
              ))}
            </div>

            <div ref={sentinelRef} className="flex justify-center py-6">
              {isLoadingMore && (
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              )}
              {!hasMore && !isLoadingMore && (
                <p className="text-muted-foreground font-mono text-[11px] tracking-[0.3em]">
                  {t('videos.all_loaded')} · {videos.length}
                </p>
              )}
            </div>

            <div className="text-muted-foreground border-border mt-2 flex items-center justify-between border-t pt-3 font-mono text-[11px] tracking-[0.18em]">
              <span className="whitespace-nowrap">
                {t('videos.last_sync')} {lastSync}
              </span>
              <span className="whitespace-nowrap">
                {t('videos.sort_newest')}
              </span>
            </div>
          </>
        )}
      </div>

      {activeVideo && (
        <VideoLightbox
          video={activeVideo}
          onClose={() => setActiveIndex(null)}
        />
      )}
    </div>
  );
}
