import { Permission } from '@/constant';
import { uploadAssetFile } from '@/lib/storage/upload-file';
import {
  withActionPermission,
  type ActionResponse,
} from '@/utils/action-response';
import { createLogger } from '@/utils/logger';

const logger = createLogger('UploadActions');

// ============================================================
// 统一上传 Server Action
// 文件直接写入 R2（未配置 R2 时写本地 uploads），不再经 Go 转发。
// ============================================================

type UploadResultConfig =
  | {
      kind: 'raw-url';
      message?: string;
    }
  | {
      kind: 'image-full';
      message?: string;
    };

/** 根据 UploadResultConfig 推断返回数据类型 */
export type UploadActionResult<R extends UploadResultConfig> = R extends {
  kind: 'image-full';
}
  ? {
      image: {
        url: string;
        width: number;
        height: number;
        ratio: number;
      };
      message: string;
    }
  : R extends { kind: 'raw-url' }
    ? { url: string; message: string }
    : never;

export interface UploadActionConfig<R extends UploadResultConfig> {
  /** 日志用名 */
  name: string;
  /** 所需权限 */
  permission: Permission;
  /** 限流 key 模板，支持 {userId} 占位 */
  rateLimitKey: string;
  /** FormData 字段名 */
  formField: string;
  /** 校验时的标签（用于错误提示） */
  label: string;
  /** uploads 下的存储子目录，如 images/blog */
  dir: string;
  /** 上传处理类型：image 走 WebP 处理；raw 原样保存 */
  target: 'image' | 'raw';
  /** 图片质量（仅 target=image，默认 50） */
  quality?: number;
  /** 返回结构配置 */
  result: R;
  /** 视频/音频等非图片的 MIME 前缀（保留字段，类型校验由上传模块负责） */
  mimePrefix?: string;
}

/**
 * 创建一个上传 Server Action：权限校验 + 限流 + 写入存储。
 * 图片会被转换为 WebP 并保留源文件；其他文件原样保存。
 */
export function createUploadAction<R extends UploadResultConfig>(
  config: UploadActionConfig<R>
): (formData: FormData) => Promise<ActionResponse<UploadActionResult<R>>> {
  return async (formData: FormData) => {
    return withActionPermission(
      config.permission,
      async (user) => {
        try {
          const file = formData.get(config.formField) as File | null;
          if (!file) {
            return {
              success: false,
              error: `未提供${config.label}文件`,
            };
          }

          const data = await uploadAssetFile(file, {
            dir: config.dir,
            target: config.target,
            quality: config.quality,
          });

          const msg = config.result.message ?? `${config.label}上传成功`;

          if (config.result.kind === 'image-full') {
            const w = data.width;
            const h = data.height;
            const resultData = {
              image: {
                url: data.url,
                width: w,
                height: h,
                ratio: w && h ? w / h : 1,
              },
              message: msg,
            } as UploadActionResult<R>;
            logger.info(`${config.name}上传成功`, {
              fileName: file.name,
              userId: user.id,
            });
            return { success: true, data: resultData };
          }

          const resultData = {
            url: data.url,
            message: msg,
          } as UploadActionResult<R>;
          logger.info(`${config.name}上传成功`, {
            fileName: file.name,
            userId: user.id,
          });
          return { success: true, data: resultData };
        } catch (error) {
          logger.error(`${config.name}上传失败`, error);
          const errorMessage =
            error instanceof Error ? error.message : '上传失败';
          return { success: false, error: errorMessage };
        }
      },
      {
        rateLimitKey: config.rateLimitKey.replace(/:?\{userId\}/g, ''),
      }
    );
  };
}
