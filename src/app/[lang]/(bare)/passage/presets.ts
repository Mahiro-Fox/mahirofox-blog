/**
 * 照片长廊的可调参数与预设。
 *
 * 六套预设照搬自 Passage Gallery 的官方 demo，只保留「调色/密度/镜头」这一组
 * 与画面构成有关的字段；blur / look / hover / seed 和几个开关是个人偏好，
 * 切预设时保持不动。
 */
export type PassagePresetId =
  | 'night'
  | 'gallery'
  | 'neon'
  | 'archive'
  | 'warp'
  | 'hall';

/** 与画面构成相关的参数，也就是预设会整体替换的那一部分 */
export interface PassagePreset {
  colors: [string, string];
  background: string;
  lanes: number;
  gap: number;
  radius: number;
  photoFill: number;
  accentFill: number;
  lineOpacity: number;
  fog: number;
  speed: number;
  boost: number;
  fov: number;
}

/** 面板里的完整参数集 */
export interface PassageParams extends PassagePreset {
  blur: number;
  look: number;
  hover: number;
  seed: number;
  focusOnClick: boolean;
  captions: boolean;
  wheel: boolean;
  interactive: boolean;
  paused: boolean;
}

export const PASSAGE_PRESETS: Record<PassagePresetId, PassagePreset> = {
  night: {
    colors: ['#5227FF', '#FF9FFC'],
    background: '#0A0A0A',
    lanes: 5,
    gap: 0.1,
    radius: 0.06,
    photoFill: 0.3,
    accentFill: 0.06,
    lineOpacity: 0.12,
    fog: 1,
    speed: 0.6,
    boost: 10,
    fov: 72,
  },
  gallery: {
    colors: ['#B19EEF', '#FF9FFC'],
    background: '#F4F4F5',
    lanes: 5,
    gap: 0.14,
    radius: 0.04,
    photoFill: 0.34,
    accentFill: 0.02,
    lineOpacity: 0.16,
    fog: 1.1,
    speed: 0.4,
    boost: 8,
    fov: 68,
  },
  neon: {
    colors: ['#3D5AFE', '#FF2BD6'],
    background: '#050505',
    lanes: 5,
    gap: 0,
    radius: 0,
    photoFill: 0.22,
    accentFill: 0.22,
    lineOpacity: 0.2,
    fog: 0.9,
    speed: 0.8,
    boost: 12,
    fov: 74,
  },
  archive: {
    colors: ['#5227FF', '#FF9FFC'],
    background: '#0A0A0A',
    lanes: 4,
    gap: 0.16,
    radius: 0.1,
    photoFill: 0.4,
    accentFill: 0,
    lineOpacity: 0.07,
    fog: 1.4,
    speed: 0.35,
    boost: 8,
    fov: 66,
  },
  warp: {
    colors: ['#5227FF', '#FF9FFC'],
    background: '#0A0A0A',
    lanes: 4,
    gap: 0.08,
    radius: 0.05,
    photoFill: 0.3,
    accentFill: 0.08,
    lineOpacity: 0.14,
    fog: 0.8,
    speed: 2.4,
    boost: 6,
    fov: 84,
  },
  hall: {
    colors: ['#5227FF', '#FF9FFC'],
    background: '#0A0A0A',
    lanes: 9,
    gap: 0.1,
    radius: 0.06,
    photoFill: 0.24,
    accentFill: 0.05,
    lineOpacity: 0.1,
    fog: 0.7,
    speed: 0.45,
    boost: 10,
    fov: 62,
  },
};

export const PRESET_IDS: PassagePresetId[] = [
  'night',
  'gallery',
  'neon',
  'archive',
  'warp',
  'hall',
];

/** 预设之外的个人偏好默认值 */
const PREFERENCES = {
  blur: 1,
  look: 1,
  hover: 1,
  seed: 0,
  focusOnClick: true,
  captions: true,
  wheel: true,
  interactive: true,
  paused: false,
};

export const PASSAGE_DEFAULTS: PassageParams = {
  ...PASSAGE_PRESETS.night,
  ...PREFERENCES,
};

export function paramsForPreset(id: PassagePresetId): PassageParams {
  return { ...PASSAGE_DEFAULTS, ...PASSAGE_PRESETS[id] };
}

/** 判断某个颜色是否需要把叠在上面的文字切成深色 */
export function isLightColor(input: string): boolean {
  const value = input.trim().replace('#', '');
  const hex =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
  const channel = (offset: number) => {
    const raw = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return raw <= 0.04045 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return luminance > 0.45;
}

/** 面板文案，由服务端按语言注入 */
export interface PassageLabels {
  open: string;
  close: string;
  title: string;
  description: string;
  preset: string;
  presetHint: string;
  appearance: string;
  parameters: string;
  presets: Record<PassagePresetId, string>;
  colorA: string;
  colorB: string;
  background: string;
  lanes: string;
  gap: string;
  radius: string;
  photoFill: string;
  accentFill: string;
  lineOpacity: string;
  fog: string;
  speed: string;
  boost: string;
  blur: string;
  look: string;
  fov: string;
  hover: string;
  seed: string;
  focusOnClick: string;
  captions: string;
  wheel: string;
  interactive: string;
  paused: string;
  reset: string;
}
