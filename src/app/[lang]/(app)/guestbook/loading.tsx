import { Skeleton, SkeletonLines } from '@/components/shared/skeleton';

/**
 * 留言板骨架。
 *
 * 标题与容器由 `guestbook/layout.tsx` 提供，这里复刻便利贴墙：
 * 3 列不等高卡片，每张含头像行、正文与可选回复块。
 */
export default function GuestbookLoading() {
  return (
    <div className="grid animate-pulse grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="bg-card border-border min-h-[200px] rounded-lg border p-6"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-3.5 w-20" />
            </div>
            <Skeleton className="h-3 w-14" />
          </div>
          <SkeletonLines count={index % 2 === 0 ? 3 : 4} />
          {index % 3 === 0 && (
            <Skeleton className="mt-4 h-16 w-full rounded" />
          )}
        </div>
      ))}
    </div>
  );
}
