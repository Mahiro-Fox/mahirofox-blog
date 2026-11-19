import { getPublicMusic } from '@/actions/admin/music-actions';
import { GlobalMusicPlayer } from '@/components/layout/global-music-player';
import { MusicProvider } from '@/context/music-provider';

/**
 * 全局音乐播放器的数据壳。
 *
 * 关键点：`getPublicMusic()` 是一次到 Go 后端的 HTTP 请求，而播放列表只被
 * GlobalMusicPlayer 消费（全站唯一 useMusic 消费者）。之前它挂在 (app) 布局的
 * Promise.all 里，等于每个前台页面的 TTFB 都要等这次后端往返。
 *
 * 现在下沉成独立组件，由布局用 <Suspense> 包住，页面主体可以先流式输出，
 * 播放器随后补齐（server-parallel-fetching / async-suspense-boundaries）。
 */
export async function MusicShell() {
  const musicRes = await getPublicMusic();
  const songs = musicRes.success ? musicRes.data : [];
  const randomIndex = songs.length > 0 ? Math.floor(Math.random() * songs.length) : 0;

  return (
    <MusicProvider playlist={songs} initialIndex={randomIndex}>
      <GlobalMusicPlayer />
    </MusicProvider>
  );
}
