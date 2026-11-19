import { Skeleton, SkeletonLines } from '@/components/shared/skeleton';

/**
 * 画廊详情骨架。
 *
 * 对应 `gallery/[slug]/page.tsx`：面包屑 → 16:9 大图（`max-w-5xl` 居中）
 * → 日期/标签行 → 标题与描述。大图占位保持 16:9，避免图片载入时整页位移。
 */
export default function GalleryDetailLoading() {
  return (
    <div className="flex animate-pulse flex-1 flex-col">
      <div className="container-wrapper">
        <div className="container">
          <div className="py-4">
            <Skeleton className="h-3.5 w-64 max-w-full" />
          </div>
        </div>

        <div className="pt-4">
          <div className="mx-auto max-w-5xl px-4 md:px-0">
            <Skeleton className="aspect-video w-full rounded-lg shadow-lg" />
          </div>
        </div>

        <div className="container-wrapper py-8">
          <div className="container flex flex-col gap-8">
            <section className="flex-1">
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="mt-6 space-y-3">
                <Skeleton className="h-7 w-2/3" />
                <SkeletonLines count={2} className="max-w-2xl" />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
