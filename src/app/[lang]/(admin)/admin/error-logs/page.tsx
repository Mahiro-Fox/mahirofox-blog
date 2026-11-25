import { redirect } from 'next/navigation';
import { adminGetErrorLogs } from '@/actions/admin/error-log-actions';
import { requirePermission } from '@/lib/auth/permissions';
import ErrorLogsClient from './error-logs-client';

export default async function ErrorLogsAdminPage() {
  const permissionCheck = await requirePermission('errors:read');
  if (!permissionCheck.allowed) {
    redirect('/admin?toast=unauthorized&message=无权限访问错误日志');
  }

  const result = await adminGetErrorLogs({ page: 1, pageSize: 20 });
  const initialPage: ErrorLogPage = result.success
    ? result.data
    : { items: [], total: 0, page: 1, pageSize: 20 };

  return <ErrorLogsClient initialPage={initialPage} />;
}
