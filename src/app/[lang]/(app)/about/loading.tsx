import { Skeleton } from '@/components/shared/skeleton';

/**
 * 关于页骨架。
 *
 * 标题与容器由 `about/layout.tsx` 提供，这里只替换内容区：
 * 头像 → 昵称 → 简介 → 4 列 Bento 网格（行高固定 180px）。
 */
const BENTO_SPANS = [
  'md:col-span-2',
  'md:col-span-2',
  'md:col-span-1',
  'md:col-span-3',
  'md:col-span-2',
  'md:col-span-2',
];

export default function AboutLoading() {
  return (
    <div className="flex animate-pulse flex-col items-center space-y-6">
      <Skeleton className="h-32 w-32 rounded-full" />
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-72 max-w-full" />

      <div className="grid w-full auto-rows-[180px] grid-cols-1 gap-4 md:grid-cols-4">
        {BENTO_SPANS.map((span, index) => (
          <Skeleton key={index} className={`rounded-2xl ${span}`} />
        ))}
      </div>
    </div>
  );
}
