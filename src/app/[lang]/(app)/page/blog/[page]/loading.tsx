import { Skeleton, SkeletonCardGrid } from '@/components/shared/skeleton';

/**
 * 博客分页列表骨架。
 *
 * 对应 `page/blog/[page]`：容器 + `PageTitle` 位置 + 3 列卡片 + 底部分页器。
 */
export default function BlogListLoading() {
  return (
    <div className="flex animate-pulse flex-1 flex-col">
      <div className="container-wrapper">
        <div className="container flex flex-col gap-1">
          <section className="container border-b py-6">
            <div className="flex flex-col gap-1 pb-6">
              <Skeleton className="h-7 w-32" />
            </div>
            <SkeletonCardGrid count={9} />
          </section>
        </div>
      </div>

      <div className="flex justify-center gap-2 py-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-9 rounded-md" />
        ))}
      </div>
    </div>
  );
}
