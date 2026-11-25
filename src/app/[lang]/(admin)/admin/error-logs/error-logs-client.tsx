'use client';

import { ChevronLeft, ChevronRight, Eye, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import {
  adminDeleteErrorLog,
  adminDeleteErrorLogs,
  adminGetErrorLog,
  adminGetErrorLogs,
} from '@/actions/admin/error-log-actions';
import {
  AdminPageLayout,
  createRefreshAction,
} from '@/components/admin/admin-page-layout';
import { DataTable, type Column } from '@/components/admin/data-table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shadcn-ui/alert-dialog';
import { Badge } from '@/components/shadcn-ui/badge';
import { Button } from '@/components/shadcn-ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn-ui/dialog';
import { Input } from '@/components/shadcn-ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn-ui/select';
import { SelectionCheckbox } from '@/components/shared/selection-check-box';
import { formatDateWithHMS } from '@/utils/utils';

const PAGE_SIZE = 20;
const ALL = 'all';

interface FilterState {
  level: string;
  keyword: string;
}

interface DetailState {
  item: ErrorLogItem | null;
  loading: boolean;
}

function normalizeFilter(value: string): string | undefined {
  return value === ALL ? undefined : value;
}

function LevelBadge({ level }: { level: string }) {
  if (level === 'panic') {
    return (
      <Badge variant="destructive" className="text-xs">
        PANIC
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      ERROR
    </Badge>
  );
}

export default function ErrorLogsClient({
  initialPage,
}: {
  initialPage: ErrorLogPage;
}) {
  const [data, setData] = useState<ErrorLogPage>(initialPage);
  const [page, setPage] = useState(initialPage.page);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    level: ALL,
    keyword: '',
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<DetailState>({
    item: null,
    loading: false,
  });
  const [pendingDelete, setPendingDelete] = useState<ErrorLogItem | null>(null);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchLogs = async (
    targetPage: number,
    nextFilters: FilterState = filters
  ) => {
    setLoading(true);
    try {
      const result = await adminGetErrorLogs({
        page: targetPage,
        pageSize: PAGE_SIZE,
        level: normalizeFilter(nextFilters.level),
        keyword: nextFilters.keyword.trim() || undefined,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
      setData(result.data);
      setPage(result.data.page);
      setSelectedIds([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '获取错误日志失败');
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
    const next: FilterState = { level: ALL, keyword: '' };
    setFilters(next);
    void fetchLogs(1, next);
  };

  /** 删除后回补列表：当前页空了就退一页 */
  const refreshAfterDelete = (deleted: number) => {
    const remaining = Math.max(0, data.total - deleted);
    const maxPage = Math.max(1, Math.ceil(remaining / data.pageSize));
    void fetchLogs(Math.min(page, maxPage));
  };

  const handleDeleteSingle = async () => {
    if (!pendingDelete || submitting) return;
    setSubmitting(true);
    try {
      const result = await adminDeleteErrorLog(pendingDelete.id);
      if (!result.success) {
        throw new Error(result.error);
      }
      toast.success('错误日志已删除');
      setSelectedIds((prev) => prev.filter((id) => id !== pendingDelete.id));
      setPendingDelete(null);
      refreshAfterDelete(result.data.deleted);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBatch = async () => {
    if (selectedIds.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const result = await adminDeleteErrorLogs(selectedIds);
      if (!result.success) {
        throw new Error(result.error);
      }
      toast.success(`已删除 ${result.data.deleted} 条错误日志`);
      setSelectedIds([]);
      setBatchDeleteOpen(false);
      refreshAfterDelete(result.data.deleted);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '批量删除失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (item: ErrorLogItem) => {
    setDetail({ item, loading: true });
    const result = await adminGetErrorLog(item.id);
    if (result.success) {
      setDetail({ item: result.data, loading: false });
      return;
    }
    setDetail({ item, loading: false });
    toast.error(result.error);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const pageIds = data.items.map((item) => item.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const somePageSelected = pageIds.some((id) => selectedIds.includes(id));

  const toggleSelectPage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  const columns: Column<ErrorLogItem>[] = [
    {
      key: 'select',
      width: 'w-10',
      header: (
        <SelectionCheckbox
          checked={allPageSelected}
          indeterminate={somePageSelected && !allPageSelected}
          label="全选当前页"
          onChange={toggleSelectPage}
        />
      ),
      render: (item) => (
        <SelectionCheckbox
          checked={selectedIds.includes(item.id)}
          label={`选择 ${item.id}`}
          onChange={() => toggleSelect(item.id)}
        />
      ),
    },
    {
      key: 'createdAt',
      header: '时间',
      render: (item) => (
        <span className="text-sm">{formatDateWithHMS(item.createdAt)}</span>
      ),
    },
    {
      key: 'level',
      header: '级别',
      render: (item) => <LevelBadge level={item.level} />,
    },
    {
      key: 'message',
      header: '错误信息',
      width: 'max-w-[200px]',
      render: (item) => (
        <>
          <p className="truncate text-sm font-medium" title={item.message}>
            {item.message}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {item.code || '-'}
            {item.status > 0 ? ` · ${item.status}` : ''}
          </p>
        </>
      ),
    },
    {
      key: 'path',
      header: '接口',
      width: 'max-w-[200px]',
      render: (item) => (
        <span
          className="text-muted-foreground block truncate font-mono text-xs"
          title={`${item.method} ${item.path}`}
        >
          {item.method} {item.path}
        </span>
      ),
    },
    {
      key: 'operator',
      header: '操作人',
      width: 'max-w-20',
      render: (item) => (
        <div className="flex flex-col">
          <span className="text-sm">{item.operatorName || '匿名'}</span>
          <span className="text-muted-foreground text-xs">
            {item.operatorRole || '-'}
          </span>
        </div>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      width: 'max-w-20',
      render: (item) => <span className="text-sm">{item.ip || '-'}</span>,
    },
    {
      key: 'count',
      header: '次数',
      render: (item) => <span className="text-sm">{item.count}</span>,
    },
  ];

  return (
    <AdminPageLayout
      title="错误日志"
      description={`共 ${data.total} 条后端错误记录`}
      actions={[createRefreshAction(() => fetchLogs(page), loading)]}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={filters.level}
          onValueChange={(value) => updateFilter({ level: value })}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="全部级别" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部级别</SelectItem>
            <SelectItem value="error">ERROR</SelectItem>
            <SelectItem value="panic">PANIC</SelectItem>
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
          placeholder="搜索错误消息 / 错误码 / 接口路径"
          className="w-72"
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

        {selectedIds.length > 0 && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setBatchDeleteOpen(true)}
            disabled={submitting}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            删除所选（{selectedIds.length}）
          </Button>
        )}
      </div>

      <div className="bg-card overflow-hidden rounded-md border">
        <DataTable
          data={data.items}
          columns={columns}
          isLoading={loading && data.items.length === 0}
          loadingText="加载错误日志..."
          emptyText="暂无错误日志"
          keyExtractor={(item) => item.id}
          actions={{
            custom: (item) => (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void openDetail(item)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingDelete(item)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ),
          }}
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

      {/* 详情 */}
      <Dialog
        open={detail.item !== null}
        onOpenChange={(open) => {
          if (!open) setDetail({ item: null, loading: false });
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail.item && <LevelBadge level={detail.item.level} />}
              <span className="truncate">{detail.item?.message}</span>
            </DialogTitle>
            <DialogDescription>
              {detail.item
                ? `${detail.item.method} ${detail.item.path} · ${formatDateWithHMS(detail.item.createdAt)}`
                : ''}
            </DialogDescription>
          </DialogHeader>

          {detail.loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span className="text-muted-foreground text-sm">加载详情...</span>
            </div>
          ) : detail.item ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <DetailField label="错误码" value={detail.item.code || '-'} />
                <DetailField
                  label="HTTP 状态"
                  value={detail.item.status ? String(detail.item.status) : '-'}
                />
                <DetailField
                  label="操作人"
                  value={
                    detail.item.operatorName
                      ? `${detail.item.operatorName}（${detail.item.operatorRole || '-'}）`
                      : '匿名'
                  }
                />
                <DetailField label="IP" value={detail.item.ip || '-'} />
                <DetailField
                  label="请求 ID"
                  value={detail.item.requestId || '-'}
                />
                <DetailField
                  label="累计次数"
                  value={`${detail.item.count} 次`}
                />
                <DetailField
                  label="首次出现"
                  value={formatDateWithHMS(detail.item.firstSeenAt)}
                />
                <DetailField
                  label="最近出现"
                  value={formatDateWithHMS(detail.item.lastSeenAt)}
                />
              </div>

              <DetailBlock label="User-Agent" value={detail.item.userAgent} />
              <DetailBlock label="上下文" value={detail.item.detail} />
              <DetailBlock label="堆栈" value={detail.item.stack} mono />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* 单条删除确认 */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除这条错误日志？</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.message}
              <br />
              删除后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteSingle();
              }}
            >
              {submitting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量删除确认 */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              确认删除选中的 {selectedIds.length} 条错误日志？
            </AlertDialogTitle>
            <AlertDialogDescription>
              该操作不可撤销，请确认已选中的日志不再需要保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteBatch();
              }}
            >
              {submitting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPageLayout>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="break-all">{value}</p>
    </div>
  );
}

function DetailBlock({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs">{label}</p>
      <pre
        className={`bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </pre>
    </div>
  );
}
