import { Skeleton } from '@/components/shared/skeleton';

/**
 * MIDI 页骨架。
 *
 * 标题与说明由 `midi/layout.tsx` 提供，这里复刻播放器：
 * 进度条区块 + `1fr auto auto` 三列表格（曲名 / 时长 / 操作）。
 */
export default function MidiLoading() {
  return (
    <div className="animate-pulse space-y-4">
      {/* 播放控制区 */}
      <div className="space-y-3">
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>
      </div>

      {/* 曲目表 */}
      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b px-4 py-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-12" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b px-4 py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
