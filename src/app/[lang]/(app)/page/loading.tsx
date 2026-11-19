/**
 * 内容浏览入口骨架。
 *
 * `page/page.tsx` 本身几乎是空页面（卡片列表已注释掉），只有一层容器，
 * 所以这里不做任何占位块 —— 放了反而会闪一下不该存在的内容。
 * 保留文件的意义是给 `/page` 一个与真实页面高度一致的壳。
 */
export default function BrowseLoading() {
  return (
    <div className="container-wrapper">
      <div className="container min-h-[40vh] py-8" />
    </div>
  );
}
