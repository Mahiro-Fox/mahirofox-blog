'use server';

import { MIDI_DIR } from '@/constant/dir';
import { getMidis, readMidiFile } from '@/lib/content/midi';
import { createUploadAction } from '@/lib/storage/create-upload-action';
import {
  deleteUploadFile,
  listUploadFiles,
  renameUploadEntry,
  resolveUploadKey,
  uploadFileExists,
} from '@/lib/storage/uploads';
import {
  withActionPermission,
  type ActionResponse,
} from '@/utils/action-response';
import { createLogger } from '@/utils/logger';

const logger = createLogger('MidiActions');

/** MIDI 列表每页默认条数 */
const MIDI_LIST_DEFAULT_LIMIT = 20;
/** MIDI 列表每页最大条数 */
const MIDI_LIST_MAX_LIMIT = 100;

export interface AdminGetMidiFilesParams {
  page?: number;
  limit?: number;
  /** 文件名关键字，大小写不敏感 */
  search?: string;
}

function midiKey(name: string): string {
  return resolveUploadKey(`uploads/midisongs/${name}`);
}

/** 校验 MIDI 名称是否可安全用作文件名 */
function isValidMidiName(name: string): boolean {
  return (
    !!name &&
    !name.includes('/') &&
    !name.includes('\\') &&
    name !== '.' &&
    name !== '..'
  );
}

// GET - 获取 MIDI 文件列表（支持搜索与分页）
export async function adminGetMidiFiles(
  params: AdminGetMidiFilesParams = {}
): Promise<ActionResponse<MidiAdminFilesPage>> {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const limit = Math.min(
    MIDI_LIST_MAX_LIMIT,
    Math.max(1, Math.floor(params.limit ?? MIDI_LIST_DEFAULT_LIMIT))
  );
  const search = (params.search ?? '').trim().toLowerCase();

  return withActionPermission(
    'midi:read',
    async () => {
      try {
        const entries = await listUploadFiles(MIDI_DIR, ['.mid']);

        const items: MidiAdminFile[] = entries
          .map((entry) => {
            const name = entry.name.replace(/\.mid$/i, '');
            if (search && !name.toLowerCase().includes(search)) return null;
            return {
              slug: name,
              fileName: entry.name,
              name,
              size: entry.size,
              lastModified: entry.lastModified.toISOString(),
            };
          })
          .filter((item): item is MidiAdminFile => item !== null)
          .sort(
            (a, b) =>
              new Date(b.lastModified).getTime() -
              new Date(a.lastModified).getTime()
          );

        const total = items.length;
        const totalPages = Math.ceil(total / limit);
        const currentPage = totalPages > 0 ? Math.min(page, totalPages) : page;
        const start = (currentPage - 1) * limit;

        return {
          success: true,
          data: {
            files: items.slice(start, start + limit),
            pagination: {
              page: currentPage,
              limit,
              total,
              totalPages,
              hasMore: currentPage < totalPages,
            },
          },
        };
      } catch (error) {
        logger.error('获取 MIDI 文件列表失败', error);
        return { success: false, error: '获取文件列表失败' };
      }
    },
    { rateLimitKey: 'midi' }
  );
}

// POST - 上传 MIDI 文件（multipart），直接写入 R2
export const adminUploadMidiFile = createUploadAction({
  name: 'MIDI文件',
  permission: 'midi:create',
  rateLimitKey: 'midi:{userId}',
  formField: 'file',
  label: 'MIDI',
  dir: 'midisongs',
  target: 'raw',
  result: { kind: 'raw-url', message: 'MIDI文件上传成功' },
});

// DELETE - 删除 MIDI 文件
export async function adminDeleteMidiFile(
  slug: string
): Promise<ActionResponse<void>> {
  return withActionPermission(
    'midi:delete',
    async (user) => {
      try {
        if (!slug) {
          return { success: false, error: 'slug 不能为空' };
        }
        if (!isValidMidiName(slug)) {
          return { success: false, error: '非法路径' };
        }

        const key = midiKey(`${slug}.mid`);
        if (!(await uploadFileExists(key))) {
          return { success: false, error: '文件不存在' };
        }

        await deleteUploadFile(key);
        logger.info('删除 MIDI 文件成功', { slug, userId: user.id });
        return { success: true, data: undefined };
      } catch (error) {
        logger.error('删除 MIDI 文件失败', error, { slug });
        const msg = error instanceof Error ? error.message : '删除文件失败';
        return { success: false, error: msg };
      }
    },
    { rateLimitKey: 'midi' }
  );
}

// PUT - 重命名 MIDI 文件
export async function adminRenameMidiFile(
  oldSlug: string,
  newName: string
): Promise<ActionResponse<void>> {
  return withActionPermission(
    'midi:update',
    async (user) => {
      const trimmed = newName.trim();
      if (!trimmed) {
        return { success: false, error: '新名称不能为空' };
      }
      if (!isValidMidiName(trimmed)) {
        return { success: false, error: '非法新名称' };
      }

      try {
        const oldKey = midiKey(`${oldSlug}.mid`);
        const newKey = midiKey(`${trimmed}.mid`);

        if (await uploadFileExists(newKey)) {
          return { success: false, error: `名称 ${trimmed} 已存在` };
        }
        if (!(await uploadFileExists(oldKey))) {
          return { success: false, error: '原文件不存在' };
        }

        await renameUploadEntry(oldKey, `${trimmed}.mid`);
        logger.info('重命名 MIDI 文件成功', {
          oldSlug,
          newName: trimmed,
          userId: user.id,
        });
        return { success: true, data: undefined };
      } catch (error) {
        logger.error('重命名 MIDI 文件失败', error, { oldSlug, newName });
        const msg = error instanceof Error ? error.message : '重命名文件失败';
        return { success: false, error: msg };
      }
    },
    { rateLimitKey: 'midi' }
  );
}

// 读取公开 MIDI 列表（含时长解析）
export async function getPublicMidis(): Promise<ActionResponse<MidiFile[]>> {
  try {
    const files = await getMidis();
    const midiFiles = await Promise.all(
      files.map((file) => readMidiFile(file))
    );

    return {
      success: true,
      data: midiFiles.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    };
  } catch (error) {
    logger.error('获取 MIDI 文件列表失败', error);
    return { success: false, error: '获取 MIDI 文件列表失败' };
  }
}
