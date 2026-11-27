/**
 * 照片图集。
 *
 * 所有照片先烘到一张 canvas 上（每张居中裁成正方形），再作为一个纹理给着色器
 * 用。好处是隧道里的任意格子只做一次纹理取值，不需要为每张图切换材质。
 *
 * 方形边长按张数自适应：张数越多单块越小，图集总尺寸保持可控。
 */
import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  Texture,
} from 'three';
import { MAX_ITEMS } from './grid';
import type { PassageItem } from './types';

/** 单块图集边长（px）：12 张以内可放大，超过 24 张降一档 */
function pickTileSize(count: number): number {
  if (count <= 12) return 640;
  if (count <= 24) return 512;
  return 384;
}

/**
 * 单张大图纹理的缓存上限。
 *
 * 悬停时会预取大图纹理（点开时不用等解码），但每张都是原尺寸纹理，
 * 逛一圈长廊就可能堆到十几张、上百 MB 显存。这里做成 LRU：
 * 超出上限就释放最久未用的一张。正在显示的大图每帧都会被
 * textureFor 命中而移到队尾，因此不会被误释放。
 */
const CLOSE_TEXTURE_CACHE_LIMIT = 12;

export interface PhotoAtlas {
  texture: CanvasTexture;
  /** 图集列数 / 行数，着色器据此把槽位换算成 UV */
  columns: number;
  rows: number;
  /** UV 内缩量，避免相邻块之间因 mipmap 渗色 */
  inset: number;
  /** 原始 <img>，用于按需生成大图纹理与判读宽高比 */
  images: HTMLImageElement[];
  /** 单张照片的独立纹理（大图用），图片未就绪时返回 null */
  textureFor: (index: number) => Texture | null;
  dispose: () => void;
}

export interface CreatePhotoAtlasOptions {
  items: PassageItem[];
  /** 各向异性上限，通常取 renderer.capabilities.getMaxAnisotropy() */
  anisotropy: number;
  /** 单张照片解码完成时回调，参数是图集槽位 */
  onTileReady: (index: number) => void;
}

export function createPhotoAtlas({
  items,
  anisotropy,
  onTileReady,
}: CreatePhotoAtlasOptions): PhotoAtlas {
  const list = items.slice(0, MAX_ITEMS);
  const count = Math.max(list.length, 1);
  const tile = pickTileSize(count);
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);

  const canvas = document.createElement('canvas');
  canvas.width = columns * tile;
  canvas.height = rows * tile;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // 先铺黑：图还没加载完的槽位不会透出别的颜色
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const texture = new CanvasTexture(canvas);
  // 关键：不做 sRGB 硬件解码，着色器全程在编码空间里工作
  texture.colorSpace = NoColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;

  const images: HTMLImageElement[] = [];
  const closeTextures = new Map<number, Texture>();
  let disposed = false;

  /**
   * 图集上传节流。
   *
   * 每画上一张图都要把整张图集（几十张时约 25MB）重新传到 GPU 并重建
   * mipmap，首屏 40 张图陆续加载时会触发几十次这种大上传，明显卡顿。
   * 这里把「通知引擎 + 标记纹理更新」合并到最多每 120ms 一次：
   * 一次上传带上期间画完的所有图，首屏从几十次降到十几次。
   */
  const UPLOAD_INTERVAL = 120;
  const pendingTiles: number[] = [];
  let uploadTimer: ReturnType<typeof setTimeout> | null = null;
  let lastUploadAt = 0;

  const flushPending = () => {
    uploadTimer = null;
    if (disposed || pendingTiles.length === 0) return;
    lastUploadAt = performance.now();
    texture.needsUpdate = true;
    // onTileReady 内部会安排渲染帧，届时 three 才真正上传纹理
    const tiles = pendingTiles.splice(0, pendingTiles.length);
    for (const tileIndex of tiles) onTileReady(tileIndex);
  };

  const queueTile = (index: number) => {
    pendingTiles.push(index);
    if (uploadTimer !== null) return;
    const wait = UPLOAD_INTERVAL - (performance.now() - lastUploadAt);
    if (wait <= 0) {
      flushPending();
    } else {
      uploadTimer = setTimeout(flushPending, wait);
    }
  };

  list.forEach((item, index) => {
    const image = new Image();
    // 画布要被 WebGL 采样，跨域图必须走 CORS
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    let retried = false;

    image.onload = () => {
      if (disposed || !ctx) return;
      // 居中裁成正方形，避免非等比压缩
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const sourceX = (image.naturalWidth - side) / 2;
      const sourceY = (image.naturalHeight - side) / 2;
      const targetX = (index % columns) * tile;
      const targetY = Math.floor(index / columns) * tile;
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        side,
        side,
        targetX,
        targetY,
        tile,
        tile
      );
      queueTile(index);
    };

    /**
     * 图床（static.mahirofox.com）的 CORS 只放行线上域名，本地开发或换域名时
     * 直连会被拒。这时退回同源代理 /next-api/image/raw：由服务端取图、
     * 同源返回，画布不会被污染。线上 CORS 正常时这条分支不会触发。
     */
    image.onerror = () => {
      if (retried || disposed) return;
      retried = true;
      image.src = `/next-api/image/raw?src=${encodeURIComponent(item.src)}`;
    };

    image.src = item.src;
    images.push(image);
  });

  return {
    texture,
    columns,
    rows,
    inset: 1.5 / tile,
    images,
    textureFor: (index) => {
      const cached = closeTextures.get(index);
      if (cached) {
        // 命中后移到队尾，标记为最近使用
        closeTextures.delete(index);
        closeTextures.set(index, cached);
        return cached;
      }
      const image = images[index];
      if (!image || !image.complete || !image.naturalWidth) return null;
      const single = new Texture(image);
      single.colorSpace = NoColorSpace;
      single.minFilter = LinearMipmapLinearFilter;
      single.magFilter = LinearFilter;
      single.generateMipmaps = true;
      single.anisotropy = anisotropy;
      single.needsUpdate = true;
      closeTextures.set(index, single);

      // 超出上限时淘汰队首（最久未用），释放其显存
      if (closeTextures.size > CLOSE_TEXTURE_CACHE_LIMIT) {
        const oldest = closeTextures.keys().next().value;
        if (oldest !== undefined) {
          closeTextures.get(oldest)?.dispose();
          closeTextures.delete(oldest);
        }
      }
      return single;
    },
    dispose: () => {
      disposed = true;
      if (uploadTimer !== null) {
        clearTimeout(uploadTimer);
        uploadTimer = null;
      }
      images.forEach((image) => {
        image.onload = null;
      });
      closeTextures.forEach((single) => single.dispose());
      closeTextures.clear();
      texture.dispose();
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}
