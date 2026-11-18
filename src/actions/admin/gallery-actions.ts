'use server';

import { DEFAULT_GALLERY_LIST_LIMIT } from '@/config/limit';
import { paginateItems, PaginationResult } from '@/lib/shared/pagination';
import {
  createGalleryFile,
  deleteGalleryFile,
  listGalleryFiles,
  parseGalleryJson,
  readGalleryDetail,
  renameGalleryFile,
  updateGalleryFile,
} from '@/lib/storage/content-files';
import { createUploadAction } from '@/lib/storage/create-upload-action';
import {
  withActionPermission,
  type ActionResponse,
} from '@/utils/action-response';
import { validateSlug } from '@/utils/file-utils';
import { createLogger } from '@/utils/logger';

const logger = createLogger('GalleryActions');

export interface GetPublicGalleriesOptions {
  page?: number;
  pageSize?: number;
  tagSlug?: string;
  all?: boolean;
}

export async function getPublicGalleries(
  options: GetPublicGalleriesOptions = {
    page: 1,
    pageSize: DEFAULT_GALLERY_LIST_LIMIT,
  }
): Promise<ActionResponse<PaginationResult<Gallery>>> {
  try {
    const { page, pageSize = DEFAULT_GALLERY_LIST_LIMIT, tagSlug } = options;

    const all = await listGalleryFiles();

    // 转换为 Gallery 类型
    const galleries: Gallery[] = all.map((item) => ({
      slug: item.slug,
      title: item.title,
      description: item.description,
      thumbnail: item.thumbnail,
      isPortrait: item.isPortrait,
      lastUpdated: item.lastUpdated,
      tags: item.tags,
    }));

    const filtered = tagSlug
      ? galleries.filter((item) => item.tags?.includes(tagSlug))
      : galleries;

    if (options.all)
      return {
        success: true,
        data: {
          items: filtered,
          currentPage: 1,
          totalPages: 1,
          totalItems: filtered.length,
        },
      };

    return {
      success: true,
      data: paginateItems<Gallery>(filtered, page, pageSize),
    };
  } catch (error) {
    logger.error('获取公开图库列表失败', error);
    return { success: false, error: '获取图库列表失败' };
  }
}

export async function getPublicGallery(
  slug: string
): Promise<ActionResponse<Gallery>> {
  try {
    const detail = await readGalleryDetail(slug);
    return {
      success: true,
      data: {
        slug,
        title: detail.title,
        description: detail.description,
        thumbnail: detail.thumbnail,
        isPortrait: detail.isPortrait,
        lastUpdated: detail.lastUpdated,
        tags: detail.tags,
      },
    };
  } catch (error) {
    logger.error('获取图库详情失败', error, { slug });
    return { success: false, error: '获取图库详情失败' };
  }
}

export async function adminGetGalleries(): Promise<
  ActionResponse<AdminGallery[]>
> {
  return withActionPermission('gallery:read', async () => {
    try {
      return { success: true, data: await listGalleryFiles() };
    } catch (error) {
      logger.error('获取图库文件列表失败', error);
      return { success: false, error: '获取文件列表失败' };
    }
  });
}

export async function adminGetGallery(
  slug: string
): Promise<ActionResponse<AdminGallery>> {
  return withActionPermission('gallery:read', async () => {
    try {
      return { success: true, data: await readGalleryDetail(slug) };
    } catch (error) {
      logger.error('获取图库文件失败', error, { slug });
      return { success: false, error: '文件不存在或读取失败' };
    }
  });
}

export async function adminCreateGallery(input: {
  slug: string;
  content: string;
}): Promise<ActionResponse<void>> {
  return withActionPermission(
    'gallery:create',
    async (user) => {
      try {
        const { slug, content } = input;
        if (!slug || !content) {
          return { success: false, error: '缺少必需字段 (slug, content)' };
        }

        const cleanSlug = slug.trim().toLowerCase();
        const nameCheck = validateSlug(cleanSlug);
        if (nameCheck) {
          return { success: false, error: nameCheck.error };
        }

        const data = parseGalleryJson(content);
        if (!data.title || !data.thumbnail) {
          return {
            success: false,
            error: 'JSON 内容缺少必需的字段 (title, thumbnail)',
          };
        }

        await createGalleryFile(cleanSlug, content);

        logger.info('创建图库文件成功', { slug: cleanSlug, userId: user.id });
        return { success: true, data: undefined };
      } catch (error) {
        logger.error('创建图库文件失败', error, { slug: input.slug });
        const message = error instanceof Error ? error.message : '创建失败';
        return { success: false, error: message };
      }
    },
    { rateLimitKey: 'gallery' }
  );
}

export async function adminUpdateGallery(
  slug: string,
  content: string
): Promise<ActionResponse<void>> {
  return withActionPermission(
    'gallery:update',
    async (user) => {
      try {
        const data = parseGalleryJson(content);
        if (!data.title || !data.thumbnail) {
          return {
            success: false,
            error: 'JSON 内容缺少必需的字段 (title, thumbnail)',
          };
        }

        await updateGalleryFile(slug, content);

        logger.info('更新图库文件成功', { slug, userId: user.id });
        return { success: true, data: undefined };
      } catch (error) {
        logger.error('更新图库文件失败', error, { slug });
        const message = error instanceof Error ? error.message : '更新失败';
        return { success: false, error: message };
      }
    },
    { rateLimitKey: 'gallery' }
  );
}

export async function adminRenameGalleryFile(
  slug: string,
  newSlug: string
): Promise<ActionResponse<void>> {
  return withActionPermission(
    'gallery:update',
    async (user) => {
      try {
        const cleanNewSlug = newSlug.trim().toLowerCase();
        const nameCheck = validateSlug(cleanNewSlug);
        if (nameCheck) {
          return { success: false, error: nameCheck.error };
        }

        await renameGalleryFile(slug, cleanNewSlug);

        logger.info('重命名图库文件成功', {
          slug,
          newSlug: cleanNewSlug,
          userId: user.id,
        });
        return { success: true, data: undefined };
      } catch (error) {
        logger.error('重命名图库文件失败', error, { slug, newSlug });
        const message = error instanceof Error ? error.message : '重命名失败';
        return { success: false, error: message };
      }
    },
    { rateLimitKey: 'gallery' }
  );
}

export async function adminDeleteGalleryFile(
  slug: string
): Promise<ActionResponse<void>> {
  return withActionPermission(
    'gallery:delete',
    async (user) => {
      try {
        const nameCheck = validateSlug(slug);
        if (nameCheck) {
          return { success: false, error: nameCheck.error };
        }

        await deleteGalleryFile(slug);

        logger.info('删除图库文件成功', { slug, userId: user.id });
        return { success: true, data: undefined };
      } catch (error) {
        logger.error('删除图库文件失败', error, { slug });
        const message = error instanceof Error ? error.message : '删除失败';
        return { success: false, error: message };
      }
    },
    { rateLimitKey: 'gallery' }
  );
}

// 上传图库 JSON 文件（multipart）- 由 gallery-client.tsx 的上传按钮调用
// 直接写入 R2，dir=content/gallery
export const adminUploadGalleryFile = createUploadAction({
  name: '图库JSON文件',
  permission: 'gallery:create',
  rateLimitKey: 'gallery:{userId}',
  formField: 'file',
  label: 'JSON文件',
  dir: 'content/gallery',
  target: 'raw',
  result: { kind: 'raw-url', message: 'JSON文件上传成功' },
});

export const adminUploadGalleryThumbnail = createUploadAction({
  name: '图库缩略图',
  permission: 'gallery:create',
  rateLimitKey: 'gallery:{userId}',
  formField: 'image',
  label: '图片',
  dir: 'images/gallery',
  target: 'image',
  quality: 85,
  result: { kind: 'raw-url', message: '图片上传成功' },
});
