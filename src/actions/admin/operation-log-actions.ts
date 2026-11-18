'use server';

import { buildQuery, goFetch, withGoAuth } from '@/lib/server/api-client';
import {
  withActionPermission,
  type ActionResponse,
} from '@/utils/action-response';
import { createLogger } from '@/utils/logger';

const logger = createLogger('OperationLogActions');

export interface OperationLogQueryInput {
  page?: number;
  pageSize?: number;
  resource?: string;
  action?: string;
  keyword?: string;
  /** RFC3339 时间字符串 */
  start?: string;
  end?: string;
}

/**
 * 管理员分页查询操作日志
 */
export async function adminGetOperationLogs(
  input: OperationLogQueryInput = {}
): Promise<ActionResponse<OperationLogPage>> {
  return withActionPermission('logs:read', async (_user, ctx) => {
    try {
      const query = buildQuery({
        page: String(input.page ?? 1),
        pageSize: String(input.pageSize ?? 20),
        resource: input.resource,
        action: input.action,
        keyword: input.keyword,
        start: input.start,
        end: input.end,
      });
      const data = await goFetch<OperationLogPage>(
        `/api/admin/operation-logs${query}`,
        withGoAuth(ctx)
      );
      return { success: true, data };
    } catch (error) {
      logger.error('获取操作日志失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取操作日志失败',
      };
    }
  });
}
