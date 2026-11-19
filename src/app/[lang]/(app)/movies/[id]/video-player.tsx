'use client';

import dynamic from 'next/dynamic';

// ArtPlayer(≈35KB gzip) + hls.js(≈163KB gzip) 合计约 200KB，只在播放器真正挂载后
// 才需要。静态 import 会把它们打进电影详情页的首屏 chunk，拖慢 TTI / LCP；
// 这里拆成异步 chunk（bundle-dynamic-imports）。
// ssr: false —— 播放器依赖 DOM 与 window，SSR 阶段渲染出来也无法播放。
const VideoPlayerCore = dynamic(
  () => import('./video-player-core').then((m) => m.VideoPlayerCore),
  { ssr: false, loading: () => <PlayerPlaceholder /> }
);

function PlayerPlaceholder() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        <span className="text-sm text-white/80">正在加载播放器...</span>
      </div>
    </div>
  );
}

export interface VideoPlayerProps {
  movieId: string;
  sources: MovieSource[];
  currentSourceIndex: number;
  changeSource: (index: number) => void;
}

/**
 * 电影播放器外壳。
 *
 * 只负责版式容器，真正的播放逻辑（ArtPlayer / hls.js）在 video-player-core 里，
 * 由 next/dynamic 按需加载，避免重依赖进入首屏 bundle。
 */
export function VideoPlayer(props: VideoPlayerProps) {
  return (
    <div className="bg-card border-border relative aspect-video w-full overflow-hidden rounded-lg border shadow-2xl">
      <VideoPlayerCore {...props} />
    </div>
  );
}
