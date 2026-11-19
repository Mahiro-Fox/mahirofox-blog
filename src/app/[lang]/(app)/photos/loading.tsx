import { Skeleton } from '@/components/shared/skeleton';

/**
 * 照片列表骨架。
 *
 * 标题与容器由 `photos/layout.tsx` 提供，这里只渲染瀑布流本身 ——
 * 若在此重复外层容器，会和 layout 的标题叠成两层。
 */
export default function PhotosLoading() {
  return (
    <div className="animate-pulse columns-2 gap-4 md:columns-3 lg:columns-4">
      {Array.from({ length: 12 }).map((_, index) => (
        <Skeleton
          key={index}
          className="mb-4 w-full break-inside-avoid rounded-lg"
          style={{ height: `${160 + ((index * 37) % 140)}px` }}
        />
      ))}
    </div>
  );
}
