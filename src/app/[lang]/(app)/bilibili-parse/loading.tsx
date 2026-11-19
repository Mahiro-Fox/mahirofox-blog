import { Skeleton, SkeletonLines } from '@/components/shared/skeleton';

/**
 * B 站解析页骨架。
 *
 * 标题与说明由 `bilibili-parse/layout.tsx` 提供，这里复刻内容区：
 * 顶部搜索框 → 解析结果卡片（左侧封面 + 右侧信息与操作）。
 */
export default function BilibiliParseLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 flex-1 rounded-lg" />
        <Skeleton className="h-11 w-24 rounded-lg" />
      </div>

      <div className="border-border rounded-xl border p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <Skeleton className="aspect-video w-full shrink-0 rounded-lg sm:w-64" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <SkeletonLines count={2} />
            <div className="flex flex-wrap gap-2 pt-1">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-7 w-20 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="border-border space-y-2 rounded-lg border p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
