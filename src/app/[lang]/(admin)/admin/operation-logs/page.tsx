import { redirect } from 'next/navigation';
import { adminGetOperationLogs } from '@/actions/admin/operation-log-actions';
import { requirePermission } from '@/lib/auth/permissions';
import OperationLogsClient from './operation-logs-client';

export default async function OperationLogsAdminPage() {
  const permissionCheck = await requirePermission('logs:read');
  if (!permissionCheck.allowed) {
    redirect('/admin?toast=unauthorized&message=无权限访问操作日志');
  }

  const result = await adminGetOperationLogs({ page: 1, pageSize: 20 });
  const initialPage: OperationLogPage = result.success
    ? result.data
    : { items: [], total: 0, page: 1, pageSize: 20 };

  return <OperationLogsClient initialPage={initialPage} />;
}
