import { Skeleton } from '@/components/shared/skeleton';

/**
 * 电影列表骨架。
 *
 * 标题与容器由 `movies/layout.tsx` 提供；`movies-client` 内部还有一层
 * `max-w-7xl px-4 py-8` 包裹，这里一并复刻，避免加载完成时内容整体位移。
 * 内容区：搜索框 + 标签胶囊行 + 海报网格（`aspect-[2/3]`，最多 6 列）。
 */
export default function MoviesLoading() {
  return (
    <div className="bg-background min-h-screen animate-pulse">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row">
          <Skeleton className="h-11 flex-1 rounded-lg" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-20 rounded-full" />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="aspect-[2/3] w-full rounded-xl" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
