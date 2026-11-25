/**
 * 管理后台错误日志类型
 *
 * 由 Go 后端 error_logs 表提供数据，仅记录后端业务错误与 panic。
 */

interface ErrorLogItem {
  id: string;
  /** error | panic */
  level: string;
  code: string;
  message: string;
  stack: string;
  method: string;
  path: string;
  status: number;
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  ip: string;
  userAgent: string;
  requestId: string;
  detail: string;
  /** 同指纹去重标识 */
  fingerprint: string;
  /** 去重窗口内累计出现次数 */
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
}

interface ErrorLogPage {
  items: ErrorLogItem[];
  total: number;
  page: number;
  pageSize: number;
}
