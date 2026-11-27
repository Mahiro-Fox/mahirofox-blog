import { NextRequest } from 'next/server';
import { readUploadFile } from '@/lib/storage/uploads';

/**
 * GET /next-api/image/raw?src=/uploads/xxx.webp
 *
 * 把 uploads 资源以同源方式回给浏览器。
 *
 * 用途：图床（NEXT_PUBLIC_UPLOADS_ORIGIN）的 CORS 只放行线上域名，
 * 而「把照片画进 canvas 再交给 WebGL」要求图片必须跨域可读。
 * 前端直连失败时会退回这里，由服务端取图、同源返回，画布因此不会被污染。
 * 只接受 /uploads/ 下的路径，等同于原本就公开可访问的静态资源，不额外扩大范围。
 */
const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

/** 文件名可能带中文，不能用 ASCII 白名单卡；只挡路径穿越和控制字符 */
function isSafePath(src: string): boolean {
  if (!src.startsWith('/uploads/') || src.includes('..')) return false;
  if (src.includes('\\')) return false;
  // 控制字符（含换行、NUL）一律拒绝
  for (const char of src) {
    if (char.charCodeAt(0) < 0x20) return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get('src') ?? '';

  if (!isSafePath(src)) {
    return new Response('Invalid source', { status: 400 });
  }

  const key = src.slice(1);
  const extension = key.slice(key.lastIndexOf('.')).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) {
    return new Response('Unsupported type', { status: 415 });
  }

  try {
    const buffer = await readUploadFile(key);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        // 文件名带时间戳、内容不变，可以长期缓存
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
