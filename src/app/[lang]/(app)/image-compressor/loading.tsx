import { Skeleton } from '@/components/shared/skeleton';

/**
 * 图片压缩页骨架。
 *
 * 该页的页头由客户端组件自己渲染（layout 只提供字典），所以这里一并占位：
 * 页头栏 + 3 列栅格（左侧 2 列拖拽区，右侧 1 列参数面板）。
 */
export default function ImageCompressorLoading() {
  return (
    <div className="min-h-screen animate-pulse">
      <div className="border-border border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-6 w-44" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Skeleton className="h-72 w-full rounded-xl" />
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="aspect-square rounded-lg" />
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="border-border space-y-4 rounded-xl border p-5">
              <Skeleton className="h-5 w-24" />
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-9 w-full rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
