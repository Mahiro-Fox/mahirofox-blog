'use client';

import { HomeIcon, RotateCcwIcon } from 'lucide-react';
import { Button } from '@/components/shadcn-ui/button';
import { Link } from '@/components/shared/link';

/**
 * (app) 路由组错误边界。
 *
 * 之前全站没有 error.tsx，任一服务端 action 抛错都会冒到 Next 默认错误页，
 * 用户只能整页刷新。这里给出「重试 / 回首页」两个出口。
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container flex min-h-[calc(100vh-16rem)] max-w-5xl flex-col items-center justify-center">
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center text-center">
        <div className="text-6xl font-bold opacity-10">:(</div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">
          页面加载出错
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          {error.message || '发生了未知错误，请稍后重试。'}
        </p>
        {error.digest && (
          <p className="text-muted-foreground/60 mt-1 font-mono text-xs">
            {error.digest}
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button variant="outline" onClick={reset} className="gap-2">
            <RotateCcwIcon className="size-4" />
            重试
          </Button>
          <Button variant="ghost" asChild className="gap-2">
            <Link href="/">
              <HomeIcon className="size-4" />
              返回首页
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
