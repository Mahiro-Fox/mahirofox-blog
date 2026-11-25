'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { adminGetOperationLogs } from '@/actions/admin/operation-log-actions';
import {
  AdminPageLayout,
  createRefreshAction,
} from '@/components/admin/admin-page-layout';
import { DataTable, type Column } from '@/components/admin/data-table';
import { Badge } from '@/components/shadcn-ui/badge';
import { Button } from '@/components/shadcn-ui/button';
import { Input } from '@/components/shadcn-ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn-ui/select';
import { formatDateWithHMS } from '@/utils/utils';

const PAGE_SIZE = 20;
const ALL = 'all';

const RESOURCE_LABELS: Record<string, string> = {
  auth: '登录',
  movies: '影视',
  music: '音乐',
  moments: '碎碎念',
  guestbook: '留言墙',
  bugs: 'BUG',
  accounts: '前台用户',
  users: '后台用户',
  tags: '标签',
  'role-permissions': '角色权限',
  analytics: '访问日志',
  'operation-logs': '操作日志',
};

const ACTION_LABELS: Record<string, string> = {
  login: '登录',
  create: '创建',
  update: '更新',
  delete: '删除',
  approve: '审核',
  reply: '回复',
  updateStatus: '更新状态',
  updatePassword: '修改密码',
};

// 'all' 是下拉框的「全部」哨兵值，查询时转为 undefined
function normalizeFilter(value: string): string | undefined {
  return value === ALL ? undefined : value;
}

interface FilterState {
  resource: string;
  action: string;
  keyword: string;
}

const columns: Column<OperationLog>[] = [
  {
    key: 'createdAt',
    header: '时间',
    render: (log) => (
      <span className="text-sm whitespace-nowrap">
        {formatDateWithHMS(log.createdAt)}
      </span>
    ),
  },
  {
    key: 'operator',
    header: '操作人',
    width: 'max-w-20',
    render: (log) => (
      <div className="flex flex-col">
        <span className="text-sm font-medium">
          {log.operatorName || '未知'}
        </span>
        <span className="text-muted-foreground text-xs">
          {log.operatorRole || '-'}
        </span>
      </div>
    ),
  },
  {
    key: 'action',
    header: '动作',
    render: (log) => (
      <Badge variant="secondary" className="text-xs">
        {ACTION_LABELS[log.action] || log.action}
      </Badge>
    ),
  },
  {
    key: 'resource',
    header: '资源',
    render: (log) => (
      <span className="text-sm">
        {RESOURCE_LABELS[log.resource] || log.resource || '-'}
      </span>
    ),
  },
  {
    key: 'targetId',
    header: '目标 ID',
    width: 'max-w-20',
    render: (log) => (
      <span
        className="text-muted-foreground block truncate font-mono text-xs"
        title={log.targetId}
      >
        {log.targetId || '-'}
      </span>
    ),
  },
  {
    key: 'summary',
    header: '摘要',
    render: (log) => <span className="text-sm">{log.summary || '-'}</span>,
  },
  {
    key: 'detail',
    header: '详情',
    width: 'max-w-[200px]',
    render: (log) => (
      <span
        className="text-muted-foreground block truncate font-mono text-xs"
        title={log.detail || ''}
      >
        {log.detail || '-'}
      </span>
    ),
  },
  {
    key: 'ip',
    header: 'IP / UA',
    render: (log) => (
      <div className="flex flex-col">
        <span className="text-sm">{log.ip || '-'}</span>
        <span
          className="text-muted-foreground truncate text-xs"
          title={log.userAgent}
        >
          {log.userAgent || '-'}
        </span>
      </div>
    ),
  },
  {
    key: 'result',
    header: '结果',
    render: (log) =>
      log.success ? (
        <Badge variant="secondary" className="text-xs">
          成功
        </Badge>
      ) : (
        <Badge variant="destructive" className="text-xs">
          失败 {log.status}
        </Badge>
      ),
  },
];

export default function OperationLogsClient({
  initialPage,
}: {
  initialPage: OperationLogPage;
}) {
  const [data, setData] = useState<OperationLogPage>(initialPage);
  const [page, setPage] = useState(initialPage.page);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    resource: ALL,
    action: ALL,
    keyword: '',
  });

  const fetchLogs = async (
    targetPage: number,
    nextFilters: FilterState = filters
  ) => {
    setLoading(true);
    try {
      const result = await adminGetOperationLogs({
        page: targetPage,
        pageSize: PAGE_SIZE,
        resource: normalizeFilter(nextFilters.resource),
        action: normalizeFilter(nextFilters.action),
        keyword: nextFilters.keyword.trim() || undefined,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
      setData(result.data);
      setPage(result.data.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '获取操作日志失败');
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (patch: Partial<FilterState>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    void fetchLogs(1, next);
  };

  const handleReset = () => {
    const next: FilterState = { resource: ALL, action: ALL, keyword: '' };
    setFilters(next);
    void fetchLogs(1, next);
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <AdminPageLayout
      title="操作日志"
      description={`共 ${data.total} 条后台操作记录`}
      actions={[createRefreshAction(() => fetchLogs(page), loading)]}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={filters.resource}
          onValueChange={(value) => updateFilter({ resource: value })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="全部资源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部资源</SelectItem>
            {Object.entries(RESOURCE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.action}
          onValueChange={(value) => updateFilter({ action: value })}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="全部动作" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部动作</SelectItem>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={filters.keyword}
          onChange={(event) =>
            setFilters({ ...filters, keyword: event.target.value })
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void fetchLogs(1, {
                ...filters,
                keyword: event.currentTarget.value,
              });
            }
          }}
          placeholder="搜索操作人 / 目标 ID / 摘要"
          className="w-64"
        />

        <Button size="sm" onClick={() => fetchLogs(1)} disabled={loading}>
          查询
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReset}
          disabled={loading}
        >
          重置
        </Button>
      </div>

      <div className="bg-card overflow-hidden rounded-md border">
        <DataTable
          data={data.items}
          columns={columns}
          isLoading={loading}
          loadingText="加载操作日志..."
          emptyText="暂无操作日志"
          keyExtractor={(log) => log.id}
        />
      </div>

      <div className="flex items-center justify-between py-3">
        <span className="text-muted-foreground text-sm">
          第 {page} / {totalPages} 页 · 共 {data.total} 条
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => fetchLogs(page - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => fetchLogs(page + 1)}
          >
            下一页
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </AdminPageLayout>
  );
}
