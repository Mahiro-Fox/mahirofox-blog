'use client';

import dynamic from 'next/dynamic';
import { type AnalyticsLog } from '@/actions/admin/analytics-actions';

// recharts 是重量级图表库，且图表要等数据到位才有意义。
// 懒加载成独立 chunk，避免进入 /admin 首屏 bundle（bundle-dynamic-imports）。
// 服务端组件不能直接写 ssr: false，所以这里用一个客户端壳包一层。
const AnalyticsCharts = dynamic(() => import('./analytics-charts'), {
  ssr: false,
  loading: () => <ChartsSkeleton />,
});

function ChartsSkeleton() {
  return (
    <div className="mb-6 grid gap-6 md:grid-cols-2 lg:grid-cols-2">
      <div className="bg-card col-span-full animate-pulse rounded-lg border p-6">
        <div className="bg-muted mb-4 h-5 w-32 rounded" />
        <div className="bg-muted/60 h-[300px] w-full rounded" />
      </div>
    </div>
  );
}

export default function AnalyticsChartsLazy({ logs }: { logs: AnalyticsLog[] }) {
  return <AnalyticsCharts logs={logs} />;
}
