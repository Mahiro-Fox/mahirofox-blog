import { Skeleton } from '@/components/shared/skeleton';

/**
 * 账户设置骨架。
 *
 * 版式对应 `settings/page.tsx` 的 `container-wrapper py-10` + `max-w-2xl`，
 * 内容是标题 + 若干张设置卡片（账号信息 / 登录方式 / 安全）。
 */
export default function SettingsLoading() {
  return (
    <div className="container-wrapper py-10">
      <div className="mx-auto max-w-2xl animate-pulse space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>

        {Array.from({ length: 3 }).map((_, cardIndex) => (
          <div
            key={cardIndex}
            className="bg-card border-border space-y-4 rounded-xl border p-6"
          >
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: cardIndex === 0 ? 3 : 2 }).map(
                (_, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="flex items-center justify-between gap-4"
                  >
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-8 w-32 rounded" />
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
