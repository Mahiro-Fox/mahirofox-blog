import { Skeleton, SkeletonLines } from '@/components/shared/skeleton';

/**
 * 博客详情骨架。
 *
 * 对应 `blog/[slug]/page.tsx` 的真实版式：面包屑 → 16:9 大图 → 标题/元信息 → 正文。
 * 大图位置必须占住，否则图片载入时正文会整体下移。
 */
export default function BlogDetailLoading() {
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
      </div>

      <div className="container-wrapper py-8">
        <div className="container flex flex-col gap-8">
          <article className="max-w-3xl">
            <header className="mb-10 space-y-3">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-7 w-4/5 md:h-9" />
              <Skeleton className="h-3 w-2/3" />
            </header>
            <SkeletonLines count={10} />
          </article>
        </div>
      </div>
    </div>
  );
}
