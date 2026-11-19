import { Skeleton } from '@/components/shared/skeleton';

/**
 * 视频墙骨架。
 *
 * 容器由 `videos/layout.tsx` 提供，这里复刻 `videos-wall` 的结构：
 * 左侧竖排标识（桌面端 `w-40` 吸顶）+ 右侧 `auto-rows-[72px]` 拼贴网格。
 * 网格跨行列规则与真实卡片同一套（见 `spanClass`），所以首屏高度不会跳。
 */
function spanClass(index: number): string {
  if (index === 0) return 'col-span-2 row-span-3';
  if (index % 9 === 4) return 'col-span-2 row-span-2';
  if (index % 6 === 3) return 'row-span-3';
  return 'row-span-2';
}

export default function VideosLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-6 lg:flex-row lg:gap-10">
      <aside className="lg:sticky lg:top-24 lg:h-fit lg:w-40 lg:shrink-0">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1 lg:flex-col lg:items-start">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-24" />
          <div className="mt-4 hidden space-y-2 lg:block">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="grid auto-rows-[72px] grid-flow-dense grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton
              key={index}
              className={`rounded-lg ${spanClass(index)}`}
            />
          ))}
        </div>
        <div className="flex justify-center py-6">
          <Skeleton className="h-5 w-5 rounded-full" />
        </div>
      </div>
    </div>
  );
}
