/** 画廊详情页骨架：标题 + 瀑布流占位图。 */
export default function GalleryDetailLoading() {
  return (
    <div className="container-wrapper py-8">
      <div className="container animate-pulse space-y-6">
        <div className="space-y-3">
          <div className="bg-muted/60 h-7 w-56 rounded" />
          <div className="bg-muted/40 h-3 w-80 max-w-full rounded" />
        </div>
        <div className="columns-2 gap-4 md:columns-3 lg:columns-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <div
              key={index}
              className="bg-muted/50 mb-4 w-full break-inside-avoid rounded-lg"
              style={{ height: `${160 + ((index * 37) % 140)}px` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
