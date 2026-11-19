import { Skeleton, SkeletonCardGrid } from '@/components/shared/skeleton';

/**
 * 首页骨架。
 *
 * 版式与 `page.tsx` 逐段对齐：全屏 Banner → 画廊轮播 → About → 画廊/标签双栏 → 文章列表。
 * Banner 用 `100vh` 占位而不是固定高度，避免加载完成时页面整体上跳。
 */
export default function HomeLoading() {
  return (
    <div className="flex w-full flex-1 animate-pulse flex-col">
      {/* ── Hero Banner ── */}
      <section className="relative h-[calc(100vh-48px)] w-full md:h-[calc(100vh-64px)]">
        <Skeleton className="h-full w-full rounded-none" />
      </section>

      {/* ── Gallery Carousel ── */}
      <section className="pt-12 pb-4">
        <div className="container-wrapper">
          <div className="container flex gap-4 overflow-hidden">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-44 flex-1 rounded-xl" />
            ))}
          </div>
        </div>
      </section>

      {/* ── About ── */}
      <section className="container-wrapper py-8">
        <div className="container flex items-center gap-6">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-full max-w-xl" />
            <Skeleton className="h-3 w-2/3 max-w-md" />
          </div>
        </div>
      </section>

      {/* ── Galleries & Tags ── */}
      <section className="container-wrapper py-8">
        <div className="container flex flex-col gap-10 lg:flex-row">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="aspect-video rounded-lg" />
              ))}
            </div>
          </div>
          <div className="w-full space-y-3 lg:w-64">
            <Skeleton className="h-6 w-24" />
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </section>

      {/* ── Posts ── */}
      <section className="container-wrapper py-8">
        <div className="container space-y-6">
          <Skeleton className="h-6 w-28" />
          <SkeletonCardGrid count={6} />
        </div>
      </section>
    </div>
  );
}
