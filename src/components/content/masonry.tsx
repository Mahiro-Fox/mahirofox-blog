'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/utils/utils';

interface MasonryProps<T> {
  items: T[];
  columns?: number;
  gutter?: number;
  minColumns?: number;
  minItemWidth?: number;
  className?: string;
  itemRender: (props: { data: T; index: number }) => React.ReactNode;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Masonry = <T extends { [key: string]: any }>({
  items = [],
  columns = 4,
  gutter = 16,
  minColumns = 1,
  minItemWidth = 220,
  className,
  itemRender,
}: MasonryProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentColumns, setCurrentColumns] = useState(columns);

  // 1. 动态调整列数：修正逻辑锁死问题
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      // 计算理想列数
      let cols = Math.floor(width / minItemWidth);
      // 限制在 [minColumns, columns] 范围内
      cols = Math.max(minColumns, Math.min(columns, cols || 1));

      // 只有当列数真的改变时才触发更新
      setCurrentColumns((prev) => (prev !== cols ? cols : prev));
    });

    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [columns, minColumns, minItemWidth]); // 移除对 currentColumns 的依赖

  // 2. 瀑布流分列计算
  const columnData = useMemo(() => {
    const result: Array<Array<{ item: T; index: number; height: number }>> =
      Array.from({ length: currentColumns }, () => []);
    const columnHeights = new Array(currentColumns).fill(0);

    // 获取当前容器的大致宽度，用于更准地预估高度
    const containerWidth = containerRef.current?.offsetWidth || 1200;
    const approxColWidth =
      (containerWidth - (currentColumns - 1) * gutter) / currentColumns;

    items.forEach((item, index) => {
      // 贪心算法：找到当前最短的列
      let minHeightIndex = 0;
      for (let i = 1; i < currentColumns; i++) {
        if (columnHeights[i] < columnHeights[minHeightIndex]) {
          minHeightIndex = i;
        }
      }

      // 高度计算逻辑：(1 / 宽高比) * 实际渲染宽度
      const itemRatio = item.ratio || 1;
      // 如果 item 包含非图片高度（如文字），建议在这里加一个固定偏移量，例如 + 60
      const estimatedHeight = (1 / itemRatio) * approxColWidth;

      // 连同原始下标一起入列，避免回调拿到的是「列内下标」
      // estimatedHeight 同时作为 content-visibility 的占位高度
      result[minHeightIndex].push({ item, index, height: estimatedHeight });

      columnHeights[minHeightIndex] += estimatedHeight + gutter;
    });

    return result;
  }, [items, currentColumns, gutter]);

  return (
    <div
      className={cn(`flex w-full`, className)}
      style={{ gap: `${gutter}px` }}
      ref={containerRef}
    >
      {columnData.map((colItems, colIndex) => (
        <div
          key={`col-${colIndex}`}
          // min-w-0：允许列被压缩到内容最小宽度以下，否则单列时会被图片原始宽度撑破
          className="flex min-w-0 flex-1 flex-col"
          style={{ gap: `${gutter}px` }}
        >
          {colItems.map(({ item, index, height }) => (
            <div
              key={item.template_id || item.src}
              // content-visibility 跳过屏外绘制；占位高度沿用上面的预估，
              // 渲染过后浏览器会记住真实高度（auto 关键字），不会来回跳。
              className="cv-auto w-full"
              style={{ containIntrinsicSize: `auto ${Math.round(height)}px` }}
            >
              {itemRender({ data: item, index })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Masonry;
