'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';
import type { VideoItem } from '@/lib/videos';
import { formatDate, formatMediaSize } from '@/utils/utils';

interface VideoLightboxProps {
  video: VideoItem;
  onClose: () => void;
}

/** 全屏播放层：Esc 关闭，滚动锁定，点击背景收起 */
export function VideoLightbox({ video, onClose }: VideoLightboxProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={video.filename}
      onClick={onClose}
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/92 p-4 sm:p-8"
    >
      <div
        className="w-full max-w-5xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white/90">
              {video.filename}
            </p>
            <p className="mt-1 font-mono text-[11px] tracking-[0.18em] text-white/45">
              {formatMediaSize(video.size)} · {formatDate(video.lastModifiedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full border border-white/25 p-2 text-white/70 transition-colors hover:border-white/50 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <video
          src={video.src}
          controls
          autoPlay
          playsInline
          className="max-h-[75vh] w-full rounded-lg bg-black"
        />
      </div>
    </div>
  );
}
