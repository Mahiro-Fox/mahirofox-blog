/** 博客详情页骨架：标题 + 元信息 + 正文段落，贴近文章页版式以减少跳变。 */
export default function BlogDetailLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="container-wrapper py-8">
        <div className="container animate-pulse">
          <article className="max-w-3xl">
            <header className="mb-10 space-y-3">
              <div className="bg-muted/40 h-3 w-40 rounded" />
              <div className="bg-muted/60 h-7 w-4/5 rounded md:h-9" />
              <div className="bg-muted/40 h-3 w-2/3 rounded" />
            </header>
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, index) => (
                <div
                  key={index}
                  className="bg-muted/40 h-3.5 rounded"
                  style={{ width: `${70 + ((index * 13) % 30)}%` }}
                />
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
