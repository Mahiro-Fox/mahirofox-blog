import type { CSSProperties } from 'react';
import { cn } from '@/utils/utils';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * 骨架块。
 *
 * 只负责底色与圆角，**不**自带 `animate-pulse` —— 动画统一交给外层容器，
 * 否则每个块各自起跳，方块之间会不同步、看起来像在抽搐。
 *
 * @example
 * <div className="animate-pulse">
 *   <Skeleton className="h-4 w-2/3" />
 * </div>
 */
export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn('bg-muted/50 shrink-0 rounded', className)}
      style={style}
    />
  );
}

interface SkeletonCardGridProps {
  count?: number;
  className?: string;
}

/**
 * 卡片网格骨架，对应 `LinkCard` 的 vertical 变体：
 * 16:9 封面 + 标题 + 描述 + 日期徽标。
 *
 * 默认列数与 `page/blog/[page]`、`page/gallery/[page]`、标签详情页一致。
 */
export function SkeletonCardGrid({ count = 6, className }: SkeletonCardGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-2 py-2">
          <Skeleton className="aspect-video w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

interface SkeletonLinesProps {
  count?: number;
  className?: string;
}

/** 多行段落骨架，宽度按下标错开，避免看起来像色块条 */
export function SkeletonLines({ count = 3, className }: SkeletonLinesProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-3"
          style={{ width: `${72 + ((index * 17) % 26)}%` }}
        />
      ))}
    </div>
  );
}
