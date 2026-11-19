'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getPhotosAction, type PhotosResponse } from '@/actions/app/photos';
import type { PhotoItem } from '@/lib/content/photos';

/** 分页加载图片的函数，默认读取相册目录 */
type PhotosFetcher = (page: number, limit: number) => Promise<PhotosResponse>;

interface UsePhotosOptions {
  initialPage?: number;
  limit?: number;
  /** 自定义数据源，用于读取其他图片目录 */
  fetcher?: PhotosFetcher;
}

export function usePhotos(options: UsePhotosOptions = {}) {
  const { initialPage = 1, limit = 12, fetcher } = options;

  const [images, setImages] = useState<PhotoItem[]>([]);
  // 首屏数据来自 server action，初始若为 false 会先闪一帧「暂无图片」，
  // 所以默认就按加载中处理，等首个响应回来再决定空状态。
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(initialPage);

  /**
   * 哨兵节点用 state 承载：ref 回调只在挂载/卸载时触发重渲染，
   * 观察器 effect 因此能等到节点真正存在时再建立。
   *
   * 只用 useRef 会踩坑：首屏第一批数据还没回来时哨兵尚未渲染，
   * effect 就在那时建好了观察器（ref 为 null，attach 失败）；
   * 而首批数据落地时各依赖值可能恰好都等于初始值
   * （page 1→1、hasMore true→true、isLoading false→false），effect 不再执行，
   * 观察器就永远 attach 不上 —— 表现为刷新页面后上拉不再加载。
   */
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);

  /** 同一时刻只允许一个翻页请求，避免观察器在 state 落地前重复触发 */
  const inFlightRef = useRef(false);

  const loadPhotos = fetcher ?? getPhotosAction;

  const fetchPhotos = useCallback(
    async (targetPage: number, isLoadMore = false) => {
      // 串行化：观察器可能在 state 落地前连续触发，重入会把同一页追加两次。
      // StrictMode 下首屏 effect 会执行两次，这里挡住的是第二次，首个请求照常落地。
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      if (isLoadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await loadPhotos(targetPage, limit);

        if (isLoadMore) {
          setImages((prev) => [...prev, ...data.images]);
        } else {
          setImages(data.images);
        }

        setHasMore(data.pagination.hasMore);
        setPage(targetPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        inFlightRef.current = false;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [limit, loadPhotos]
  );

  // Initial load
  useEffect(() => {
    fetchPhotos(initialPage, false);
  }, [fetchPhotos, initialPage]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          void fetchPhotos(page + 1, true);
        }
      },
      {
        rootMargin: '200px',
        threshold: 0.1,
      }
    );

    // 观察器只在「相交状态变化」时回调，所以每次依赖变化都重建：
    // 重建时若哨兵仍在视口内会立刻回调一次，从而继续往下加载直到填满视口。
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [sentinel, fetchPhotos, hasMore, isLoadingMore, isLoading, page]);

  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    setSentinel(node);
  }, []);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoadingMore && !isLoading) {
      fetchPhotos(page + 1, true);
    }
  }, [fetchPhotos, hasMore, isLoadingMore, isLoading, page]);

  return {
    images,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    loadMoreRef,
  };
}
