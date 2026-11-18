/**
 * 管理后台操作日志类型
 *
 * 由 Go 后端 operation_logs 表提供数据。
 */

interface OperationLog {
  id: string;
  createdAt: string;
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  action: string;
  resource: string;
  targetId: string;
  summary: string;
  detail: string;
  ip: string;
  userAgent: string;
  success: boolean;
  status: number;
}

interface OperationLogPage {
  items: OperationLog[];
  total: number;
  page: number;
  pageSize: number;
}
