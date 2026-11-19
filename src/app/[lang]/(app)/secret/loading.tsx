import { Skeleton, SkeletonLines } from '@/components/shared/skeleton';

/**
 * Secret 页骨架。
 *
 * 该页是纯静态内容（无数据请求），实际上很少会进入加载态；
 * 保留骨架是为了路由结构完整，视觉上与正文章节对齐。
 */
export default function SecretLoading() {
  return (
    <div className="container mx-auto max-w-6xl animate-pulse px-4 py-8">
      <div className="mb-8 flex justify-center">
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="space-y-6">
        <SkeletonLines count={5} />
        <SkeletonLines count={4} />
      </div>
    </div>
  );
}
