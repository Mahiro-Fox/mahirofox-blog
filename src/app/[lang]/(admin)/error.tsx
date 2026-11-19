'use client';

import { RotateCcwIcon } from 'lucide-react';
import { Button } from '@/components/shadcn-ui/button';

/** (admin) 路由组错误边界：后台出错时保留侧边栏，只替换内容区。 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="text-5xl font-bold opacity-10">:(</div>
      <h2 className="mt-4 text-xl font-semibold">后台加载出错</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        {error.message || '发生了未知错误，请稍后重试。'}
      </p>
      {error.digest && (
        <p className="text-muted-foreground/60 mt-1 font-mono text-xs">
          {error.digest}
        </p>
      )}
      <Button variant="outline" onClick={reset} className="mt-6 gap-2">
        <RotateCcwIcon className="size-4" />
        重试
      </Button>
    </div>
  );
}
