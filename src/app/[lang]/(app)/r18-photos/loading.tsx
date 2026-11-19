import { Skeleton } from '@/components/shared/skeleton';

/**
 * R18 画廊骨架。
 *
 * 标题与容器由 `r18-photos/layout.tsx` 提供，这里复刻内容区：
 * 筛选栏（左标题 + 右计数 + 横向滚动的标签胶囊）+ 瀑布流。
 */
export default function R18PhotosLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      </section>

      <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <Skeleton
            key={index}
            className="mb-4 w-full break-inside-avoid rounded-lg"
            style={{ height: `${160 + ((index * 37) % 140)}px` }}
          />
        ))}
      </div>
    </div>
  );
}
