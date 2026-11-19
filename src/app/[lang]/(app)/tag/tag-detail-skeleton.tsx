import { Skeleton, SkeletonCardGrid } from '@/components/shared/skeleton';

/**
 * 标签详情页骨架，`/tag/blog/[slug]` 与 `/tag/gallery/[slug]` 共用。
 *
 * 两页结构完全一致：面包屑 → AboutCta → 标签标题卡 → 3 列内容网格。
 */
export function TagDetailSkeleton() {
  return (
    <div className="flex animate-pulse flex-1 flex-col">
      {/* 面包屑（桌面端才显示） */}
      <div className="container-wrapper">
        <div className="container">
          <div className="hidden py-4 lg:block">
            <Skeleton className="h-3.5 w-56" />
          </div>
        </div>
      </div>

      {/* AboutCta */}
      <div className="container-wrapper">
        <div className="container py-6">
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        {/* 标签标题卡 */}
        <div className="container pb-6">
          <div className="border-border rounded-2xl border p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 内容网格 */}
      <div className="container-wrapper">
        <div className="container border-b py-6">
          <SkeletonCardGrid count={6} />
        </div>
      </div>
    </div>
  );
}
