import { Skeleton, SkeletonLines } from '@/components/shared/skeleton';

/**
 * 碎碎念骨架。
 *
 * 容器与标题由 `moments/layout.tsx` 提供，这里复刻时间线：
 * 左侧竖线 + 圆点节点 + 右侧卡片（时间行 → 正文 → 配图）。
 */
export default function MomentsLoading() {
  return (
    <div className="relative animate-pulse">
      {/* 时间轴线 */}
      <div className="bg-border absolute top-0 bottom-0 left-4 w-0.5" />

      <div className="space-y-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="relative pl-12">
            <div className="bg-muted border-background absolute left-2 h-5 w-5 rounded-full border-4" />
            <div className="bg-card rounded-lg border p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-16" />
              </div>
              <SkeletonLines count={index % 2 === 0 ? 2 : 3} />
              {index % 3 === 1 && (
                <Skeleton className="mt-4 h-32 w-56 rounded-lg" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
