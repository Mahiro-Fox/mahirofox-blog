import { Skeleton } from '@/components/shared/skeleton';

/**
 * 图片混淆页骨架。
 *
 * 页头由客户端组件渲染，这里一并占位：页头栏 + 5 列栅格
 * （左侧 3 列画布，右侧 2 列参数面板）。
 */
export default function ImageObfuscatorLoading() {
  return (
    <div className="min-h-screen animate-pulse">
      <div className="border-border border-b">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <div className="flex justify-end">
              <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
            <Skeleton className="aspect-video w-full rounded-xl" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-lg" />
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="border-border space-y-4 rounded-xl border p-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
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
