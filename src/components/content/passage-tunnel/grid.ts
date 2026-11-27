/**
 * 墙面格子表。
 *
 * 整条隧道的「哪一格放什么」被压进一张 512×256 的 RGBA 数据纹理：
 * 每格 4 字节——r = 类型（0 空 / 1 照片 / 2 强调色块）、g = 图集槽位、
 * b = 强调色块的色调、a 恒为 255。
 *
 * 布局是 (行 × 4 面墙 × 16 格位)，即 2048 × 4 × 16 = 131072 格 = 512KB。
 * 着色器用 texelFetch 直接按索引取，不做插值，因此格子边界永远干净。
 */
export const GRID_ROWS = 2048;
export const GRID_WALLS = 4;
export const GRID_LANES = 16;
export const CELL_COUNT = GRID_ROWS * GRID_WALLS * GRID_LANES;

/** 512 × 256 = 131072 个 texel，正好一格一个 */
export const CELL_TEXTURE_WIDTH = 512;
export const CELL_TEXTURE_HEIGHT = 256;

/** 单次最多加载的照片数，受着色器里 uLoaded[48] 的长度限制 */
export const MAX_ITEMS = 48;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** mulberry32：同一个 seed 永远得到同一份分布 */
function createRandom(seed: number): () => number {
  let state =
    Math.imul(Math.floor(seed * 131 + 24), 0x9e3779b1) >>> 0 || 0x9e3779b1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CellGridOptions {
  /** 可用的照片张数（图集里的槽位数） */
  photoCount: number;
  photoFill: number;
  accentFill: number;
  seed: number;
}

export function buildCellGrid({
  photoCount,
  photoFill,
  accentFill,
  seed,
}: CellGridOptions): Uint8Array {
  const data = new Uint8Array(CELL_COUNT * 4);
  const random = createRandom(seed);

  const photoRate = clamp(photoFill, 0, 1);
  const accentRate = clamp(accentFill, 0, 1 - photoRate);

  /* 洗牌发牌：一轮内不重复，并避开最近 6 格用过的图，相邻格子不会撞图 */
  const deck: number[] = [];
  const recent: number[] = [];
  const recentLimit = Math.min(6, Math.max(0, photoCount - 2));

  const takeSlot = (): number => {
    if (deck.length === 0) {
      for (let i = 0; i < photoCount; i += 1) deck.push(i);
      for (let i = deck.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    for (let i = deck.length - 1; i >= 0; i -= 1) {
      if (recentLimit === 0 || !recent.includes(deck[i])) {
        const [slot] = deck.splice(i, 1);
        recent.push(slot);
        if (recent.length > recentLimit) recent.shift();
        return slot;
      }
    }
    return deck.pop() ?? 0;
  };

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let wall = 0; wall < GRID_WALLS; wall += 1) {
      for (let lane = 0; lane < GRID_LANES; lane += 1) {
        const offset = ((row * GRID_WALLS + wall) * GRID_LANES + lane) * 4;
        const roll = random();
        const tone = random();

        if (photoCount > 0 && roll < photoRate) {
          data[offset] = 1;
          data[offset + 1] = takeSlot();
          data[offset + 2] = 0;
        } else if (roll < photoRate + accentRate) {
          data[offset] = 2;
          data[offset + 1] = 0;
          data[offset + 2] = Math.round(255 * tone);
        }
        data[offset + 3] = 255;
      }
    }
  }

  return data;
}

/** 把「行/墙/格位」折算成数据纹理里的字节偏移 */
export function cellOffset(row: number, wall: number, lane: number): number {
  const wrapped = ((row % GRID_ROWS) + GRID_ROWS) % GRID_ROWS;
  const clampedLane = clamp(lane, 0, GRID_LANES - 1);
  return ((wrapped * GRID_WALLS + wall) * GRID_LANES + clampedLane) * 4;
}
