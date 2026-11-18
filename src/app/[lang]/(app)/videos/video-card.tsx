'use client';

import { Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { VideoItem } from '@/lib/content/videos';
import { cn } from '@/utils/utils';

interface VideoCardProps {
  video: VideoItem;
  index: number;
  className?: string;
  featured?: boolean;
  onOpen: () => void;
}

/** 秒 → 时间码；元数据未就绪时显示占位符，不猜测时长 */
function formatDuration(seconds: number | null): string {
  if (!seconds || !Number.isFinite(seconds)) return '--:--';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(rest)}`
    : `${pad(minutes)}:${pad(rest)}`;
}

/** 去掉扩展名，文件名即标题 */
function toTitle(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

/**
 * 录像墙单块。
 * 进入视口附近才挂载 src（只拉元数据），悬停时静音预览；
 * 触屏与 prefers-reduced-motion 下不自动播放。
 */
export function VideoCard({
  video,
  index,
  className,
  featured,
  onOpen,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const startPreview = () => {
    const node = videoRef.current;
    if (!node || node.readyState < 1) return;
    if (!window.matchMedia('(hover: hover)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    node.currentTime = 0.1;
    void node.play().catch(() => undefined);
  };

  const stopPreview = () => {
    videoRef.current?.pause();
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      aria-label={video.filename}
      className={cn(
        'group bg-muted focus-visible:ring-primary relative overflow-hidden rounded-lg border text-left transition-transform duration-200 focus-visible:ring-2 focus-visible:outline-none',
        featured ? 'border-primary border-2' : 'border-border',
        'motion-safe:hover:z-10 motion-safe:hover:scale-[1.02]',
        className
      )}
    >
      <video
        ref={videoRef}
        src={inView ? `${video.src}#t=0.1` : undefined}
        preload={inView ? 'metadata' : 'none'}
        muted
        loop
        playsInline
        disablePictureInPicture
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        className="h-full w-full object-cover"
      />

      {/* 压暗底部，保证文件名可读 */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-black/0"
      />

      {/* 焦点块的 HUD 四角 */}
      {featured && (
        <>
          <span
            aria-hidden
            className="border-primary pointer-events-none absolute top-1.5 left-1.5 h-3.5 w-3.5 border-t-2 border-l-2"
          />
          <span
            aria-hidden
            className="border-primary pointer-events-none absolute top-1.5 right-1.5 h-3.5 w-3.5 border-t-2 border-r-2"
          />
          <span
            aria-hidden
            className="border-primary pointer-events-none absolute bottom-1.5 left-1.5 h-3.5 w-3.5 border-b-2 border-l-2"
          />
          <span
            aria-hidden
            className="border-primary pointer-events-none absolute right-1.5 bottom-1.5 h-3.5 w-3.5 border-r-2 border-b-2"
          />
        </>
      )}

      {/* 左上：序号，或焦点块的 REC 呼吸点 */}
      <span className="absolute top-2 left-2 flex items-center gap-1.5 font-mono text-[11px] tracking-widest text-white/65">
        {featured ? (
          <>
            <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" />
            REC
          </>
        ) : (
          String(index + 1).padStart(2, '0')
        )}
      </span>

      {/* 右上：真实时长（读元数据后才有） */}
      <span className="absolute top-2 right-2 rounded-sm bg-black/55 px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-white/75">
        {formatDuration(duration)}
      </span>

      {/* 悬停播放按钮 */}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/40 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
          <Play className="h-4 w-4 translate-x-px fill-white text-white" />
        </span>
      </span>

      {/* 底部：文件名即标题 */}
      <span className="absolute inset-x-0 bottom-0 flex items-end p-2">
        <span className="truncate text-[12px] font-medium tracking-wide text-white/90">
          {toTitle(video.filename)}
        </span>
      </span>
    </button>
  );
}
