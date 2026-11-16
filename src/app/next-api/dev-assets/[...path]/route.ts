import path from 'path';
import { readUploadFile, resolveUploadKey } from '@/lib/server/uploads';

/**
 * 临时取证路由：本地 dev 下 nginx 不参与，/uploads/* 会 404，
 * 照片隧道（/test）需要真实图片才能验证，验证完即删。
 * 资源已迁移到 R2，这里按同一套 uploads 路径读取。
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    return new Response('not found', { status: 404 });
  }

  try {
    const buffer = await readUploadFile(
      resolveUploadKey(`/uploads/${segments.join('/')}`)
    );
    const ext = path.extname(segments[segments.length - 1] ?? '').toLowerCase();
    const type =
      ext === '.webp'
        ? 'image/webp'
        : ext === '.png'
          ? 'image/png'
          : 'application/octet-stream';
    return new Response(new Uint8Array(buffer), {
      headers: { 'Content-Type': type },
    });
  } catch {
    return new Response('not found', { status: 404 });
  }
}
