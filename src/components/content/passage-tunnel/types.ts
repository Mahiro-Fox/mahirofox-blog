/** 一张要挂进隧道墙面的照片 */
export interface PassageItem {
  src: string;
  alt: string;
  /** 打开大图时显示在字幕上的标题，缺省回落到 alt */
  title?: string;
}

/** 命令式句柄：由组件内部持有，页面通常用不到 */
export interface PassageTunnelHandle {
  /** 把当前打开的照片放回墙上 */
  close: () => void;
  /** 给相机一次推力，单位是格子数 */
  travel: (cells: number) => void;
}

export interface PassageTunnelProps {
  items: PassageItem[];
  /** 强调色块渐变的两端 */
  colors?: [string, string];
  /** 墙面与远景颜色，传 "transparent" 可露出页面本身 */
  backgroundColor?: string;
  /** 地板/天花板的格子数，侧墙按宽高比自动补齐 */
  lanes?: number;
  /** 格子间距，按格宽的比例计 */
  gap?: number;
  /** 圆角，0 为方形、1 为圆形 */
  radius?: number;
  /** 照片占格子的比例 */
  photoFill?: number;
  /** 强调色块占格子的比例 */
  accentFill?: number;
  /** 网格线不透明度 */
  lineOpacity?: number;
  /** 雾的浓度，越大越快融进背景 */
  fog?: number;
  /** 巡航速度，单位：格/秒；负值倒着走 */
  speed?: number;
  /** 长按时的加速倍数 */
  boost?: number;
  /** 高速时的运动模糊强度 */
  blur?: number;
  /** 视线跟随指针的程度 */
  look?: number;
  /** 垂直视场角 */
  fov?: number;
  /** 悬停时格子的提亮与浮起 */
  hover?: number;
  /** 点击照片是否飞出成大图 */
  focusOnClick?: boolean;
  /** 滚轮是否驱动隧道 */
  wheel?: boolean;
  /** 是否响应指针交互 */
  interactive?: boolean;
  /** 换一批格子分布 */
  seed?: number;
  /** 停止巡航（拖拽与长按仍然有效） */
  paused?: boolean;
  /** 画布最大像素比 */
  dpr?: number;
  ariaLabel?: string;
  /** 打开/放回照片时回调 */
  onFocusChange?: (item: PassageItem | null, index: number) => void;
  className?: string;
}
