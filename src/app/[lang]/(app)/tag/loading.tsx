import { Skeleton } from '@/components/shared/skeleton';

/**
 * 标签列表骨架。
 *
 * 该页没有 layout 包裹，所以容器与标题都要在这里占位：
 * 页标题 + 「文章标签」「图库标签」两段 4 列卡片网格。
 */
function TagSectionSkeleton() {
  return (
    <section className="mb-10 space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-9 rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="bg-card border-border flex items-center gap-3 rounded-xl border p-4"
          >
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-2.5 w-28" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TagsLoading() {
  return (
    <div className="container mx-auto animate-pulse px-4 py-8">
      <Skeleton className="mb-8 h-8 w-36" />
      <TagSectionSkeleton />
      <TagSectionSkeleton />
    </div>
  );
}
