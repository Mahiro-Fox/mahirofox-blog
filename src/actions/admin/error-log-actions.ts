'use server';

import { buildQuery, goFetch, withGoAuth } from '@/lib/integrations/go-api';
import {
  withActionPermission,
  type ActionResponse,
} from '@/utils/action-response';
import { createLogger } from '@/utils/logger';

const logger = createLogger('ErrorLogActions');

export interface ErrorLogQueryInput {
  page?: number;
  pageSize?: number;
  /** error | panic */
  level?: string;
  keyword?: string;
  /** RFC3339 时间字符串 */
  start?: string;
  end?: string;
}

/** 删除结果 */
export interface ErrorLogDeleteResult {
  success: boolean;
  deleted: number;
}

/**
 * 管理员分页查询后端错误日志
 */
export async function adminGetErrorLogs(
  input: ErrorLogQueryInput = {}
): Promise<ActionResponse<ErrorLogPage>> {
  return withActionPermission('errors:read', async (_user, ctx) => {
    try {
      const query = buildQuery({
        page: String(input.page ?? 1),
        pageSize: String(input.pageSize ?? 20),
        level: input.level,
        keyword: input.keyword,
        start: input.start,
        end: input.end,
      });
      const data = await goFetch<ErrorLogPage>(
        `/api/admin/error-logs${query}`,
        withGoAuth(ctx)
      );
      return { success: true, data };
    } catch (error) {
      logger.error('获取错误日志失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取错误日志失败',
      };
    }
  });
}

/**
 * 查询单条错误日志详情（含完整堆栈）
 */
export async function adminGetErrorLog(
  id: string
): Promise<ActionResponse<ErrorLogItem>> {
  return withActionPermission('errors:read', async (_user, ctx) => {
    try {
      const data = await goFetch<ErrorLogItem>(
        `/api/admin/error-logs/${encodeURIComponent(id)}`,
        withGoAuth(ctx)
      );
      return { success: true, data };
    } catch (error) {
      logger.error('获取错误日志详情失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取错误日志详情失败',
      };
    }
  });
}

/**
 * 删除单条错误日志
 */
export async function adminDeleteErrorLog(
  id: string
): Promise<ActionResponse<ErrorLogDeleteResult>> {
  return withActionPermission('errors:delete', async (_user, ctx) => {
    try {
      const data = await goFetch<ErrorLogDeleteResult>(
        `/api/admin/error-logs/${encodeURIComponent(id)}`,
        withGoAuth(ctx, { method: 'DELETE' })
      );
      return { success: true, data };
    } catch (error) {
      logger.error('删除错误日志失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除错误日志失败',
      };
    }
  });
}

/**
 * 批量删除错误日志（单次最多 500 条）
 */
export async function adminDeleteErrorLogs(
  ids: string[]
): Promise<ActionResponse<ErrorLogDeleteResult>> {
  return withActionPermission('errors:delete', async (_user, ctx) => {
    try {
      const data = await goFetch<ErrorLogDeleteResult>(
        '/api/admin/error-logs/batch',
        withGoAuth(ctx, {
          method: 'DELETE',
          body: JSON.stringify({ ids }),
        })
      );
      return { success: true, data };
    } catch (error) {
      logger.error('批量删除错误日志失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '批量删除错误日志失败',
      };
    }
  });
}
