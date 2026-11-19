/**
 * (app) 路由组通用加载骨架。
 *
 * 补上路由级 Suspense 边界后，导航时浏览器会立刻显示骨架而不是停在旧页面
 * （async-suspense-boundaries）。刻意保持轻量，避免骨架本身成为负担。
 */
export default function AppLoading() {
  return (
    <div className="container-wrapper flex-1 py-12">
      <div className="container animate-pulse space-y-8">
        <div className="bg-muted/50 h-9 w-48 rounded-lg" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="bg-card border-border overflow-hidden rounded-xl border"
            >
              <div className="bg-muted/60 aspect-video w-full" />
              <div className="space-y-3 p-4">
                <div className="bg-muted/60 h-4 w-3/4 rounded" />
                <div className="bg-muted/40 h-3 w-full rounded" />
                <div className="bg-muted/40 h-3 w-2/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
