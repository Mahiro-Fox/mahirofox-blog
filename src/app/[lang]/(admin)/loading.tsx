/** (admin) 路由组加载骨架：只占内容区，侧边栏由布局保持不动。 */
export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="bg-muted/50 h-8 w-40 rounded-lg" />
      <div className="bg-card border-border overflow-hidden rounded-xl border">
        <div className="bg-muted/40 h-12 w-full" />
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="border-border/60 flex items-center gap-4 border-t px-4 py-3"
          >
            <div className="bg-muted/50 h-3.5 flex-1 rounded" />
            <div className="bg-muted/40 h-3.5 w-24 rounded" />
            <div className="bg-muted/40 h-3.5 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
