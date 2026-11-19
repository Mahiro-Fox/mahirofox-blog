'use client';

import ArtPlayer from 'artplayer';
import Hls from 'hls.js';
import { toast } from 'sonner';
import { useEffect, useRef, useState } from 'react';
import { throttle } from '@/utils/utils';

interface SourceStatus extends MovieSource {
  available: boolean;
}

export interface VideoPlayerCoreProps {
  movieId: string;
  sources: MovieSource[];
  currentSourceIndex: number;
  changeSource: (index: number) => void;
}

const PROBE_TIMEOUT_MS = 5000;

/** 探测某条线路是否可播放（HEAD 请求，超时视为不可用） */
async function probeSource(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 播放器核心：持有 ArtPlayer / hls.js 实例。
 *
 * 由 video-player.tsx 通过 next/dynamic 懒加载，作为重依赖（约 200KB gzip）的
 * 独立 chunk，不参与电影详情页首屏 bundle。
 */
export function VideoPlayerCore({
  movieId,
  sources,
  currentSourceIndex,
  changeSource,
}: VideoPlayerCoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<ArtPlayer | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  // 线路可用性只在「切换线路」菜单里用到，放 ref 里即可：
  // 旧实现把它放进 state 并作为初始化 effect 的依赖，探活一返回就会把
  // ArtPlayer + Hls 实例整体销毁重建一次（视频重新起播）。ref 避免这次重建。
  const sourcesStatusRef = useRef<SourceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const progressKey = `movie_progress_${movieId}`;

  useEffect(() => {
    // 单线路时没有可切换项，直接视为可用，省掉一次无谓的外网探测
    if (sources.length <= 1) {
      sourcesStatusRef.current = sources.map((source) => ({
        ...source,
        available: true,
      }));
      return;
    }

    // 取消标记：effect 重跑或组件卸载后丢弃过期结果（竞态防护）
    let cancelled = false;
    void (async () => {
      const statuses = await Promise.all(
        sources.map(async (source) => ({
          ...source,
          available: await probeSource(source.url),
        }))
      );
      if (!cancelled) {
        sourcesStatusRef.current = statuses;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sources]);

  useEffect(() => {
    if (!containerRef.current || sources.length === 0) return;

    const currentSource = sources[currentSourceIndex];
    const proxyUrl = currentSource.url;

    const art = new ArtPlayer(
      {
        container: containerRef.current,
        url: proxyUrl,
        type: 'm3u8',
        loop: false,
        volume: 0.8,
        muted: false,
        theme: '#ff6b35',
        lang: 'zh-CN',
        flip: true,
        setting: true,
        aspectRatio: true,
        fullscreen: true,
        subtitleOffset: true,
        miniProgressBar: true,
        playsInline: true,
        playbackRate: true,
        controls: [
          {
            position: 'right',
            html: `<div class="artplayer-video-source-btn" style="color: #fff; cursor: pointer; padding: 0 10px; font-size: 12px;">
            ${currentSource.name}
          </div>`,
            click: () => {
              const menu = document.createElement('div');
              menu.style.cssText = `
              position: absolute;
              bottom: 100%;
              right: 20%;
              background: rgba(0, 0, 0, 0.9);
              border-radius: 8px;
              padding: 8px;
              margin-bottom: 8px;
              z-index: 100;
              min-width: 150px;
            `;

              sourcesStatusRef.current.forEach((source, index) => {
                const item = document.createElement('div');
                item.style.cssText = `
                padding: 8px 12px;
                color: ${source.available ? '#fff' : '#666'};
                font-size: 12px;
                cursor: ${source.available ? 'pointer' : 'not-allowed'};
                border-radius: 4px;
                display: flex;
                justify-content: space-between;
                align-items: center;
              `;
                item.innerHTML = `
                <span>${source.name}${index === currentSourceIndex ? ' ✓' : ''}</span>
                ${!source.available ? '<span>[不可用]</span>' : ''}
              `;

                if (source.available) {
                  item.onmouseenter = () => {
                    item.style.background = 'rgba(255, 107, 53, 0.3)';
                  };
                  item.onmouseleave = () => {
                    item.style.background = 'transparent';
                  };
                  item.onclick = () => {
                    changeSource(index);
                    menu.remove();
                  };
                }

                menu.appendChild(item);
              });
              if (art.controls.$parent) {
                art.controls.$parent.appendChild(menu);
              }
              const closeMenu = (e: MouseEvent) => {
                if (!menu.contains(e.target as Node)) {
                  menu.remove();
                  document.removeEventListener('click', closeMenu);
                }
              };

              setTimeout(() => {
                document.addEventListener('click', closeMenu);
              }, 0);
            },
          },
          {
            position: 'right',
            html: `<div class="artplayer-video-source-btn" style="color: #fff; cursor: pointer; padding: 0 10px; font-size: 12px;">
            复制当前线路m3u8链接
            </div>`,
            click: () => {
              navigator.clipboard.writeText(proxyUrl);
              toast.success('已复制链接');
            },
          },
        ],
        icons: {
          loading: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle class="artplayer-loading-circle" cx="12" cy="12" r="10" stroke-dasharray="62.8318" stroke-dashoffset="62.8318" style="animation: artplayer-loading 1s linear infinite;"/></svg>`,
        },
      },
      function onReady(art) {
        const savedProgress = localStorage.getItem(progressKey);
        if (savedProgress) {
          const progress = parseFloat(savedProgress);
          if (progress > 0 && progress < art.duration) {
            const minutes = Math.floor(progress / 60);
            const seconds = Math.floor(progress % 60);
            art.seek = progress; // ArtPlayer 方法
            toast.info(
              `已为你自动跳转至上次看到 ${minutes}:${seconds.toString().padStart(2, '0')}`
            );
          }
        }
      }
    );

    artRef.current = art;

    let hls: Hls | undefined;

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
      });

      hls.loadSource(proxyUrl);
      hls.attachMedia(art.video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn('HLS Warn:', data);

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (currentSourceIndex < sources.length - 1) {
                const nextIndex = currentSourceIndex + 1;
                toast.warning(
                  `当前线路不稳定，已自动为你切换至备用线路：${sources[nextIndex].name}`
                );
                changeSource(nextIndex);
              } else {
                toast.error('所有线路均无法播放，请稍后重试');
              }
              break;
            default:
              break;
          }
        }
      });
    }

    // 节流保存进度
    const saveProgress = throttle(() => {
      localStorage.setItem(progressKey, art.currentTime.toString());
    }, 3000);
    art.on('video:timeupdate', saveProgress);

    return () => {
      if (hls) {
        hls.destroy();
      }
      art.destroy();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movieId, sources, currentSourceIndex]);

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
          <div className="flex flex-col items-center">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
            <span className="text-sm text-white/80">正在加载视频资源...</span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </>
  );
}
