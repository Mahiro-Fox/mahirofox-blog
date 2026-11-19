import { Skeleton, SkeletonLines } from '@/components/shared/skeleton';

/**
 * 电影详情骨架。
 *
 * 复刻 `movie-detail-client` 的版式：顶部留白 + 3 列栅格
 * （左侧 2 列是播放器与信息卡，右侧 1 列是剧集/来源列表）。
 */
export default function MovieDetailLoading() {
  return (
    <div className="bg-background min-h-screen animate-pulse">
      <div className="pt-20">
        <div className="mx-auto max-w-7xl px-4 pb-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Skeleton className="mb-6 aspect-video w-full rounded-xl" />
              <div className="bg-card border-border rounded-xl border p-6">
                <div className="mb-6 flex flex-wrap items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="mb-4 h-6 w-1/2" />
                <SkeletonLines count={3} />
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-card border-border space-y-3 rounded-xl border p-6">
                <Skeleton className="h-5 w-24" />
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-full rounded" />
                ))}
              </div>
              <div className="bg-card border-border space-y-3 rounded-xl border p-6">
                <Skeleton className="h-5 w-20" />
                <SkeletonLines count={2} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
