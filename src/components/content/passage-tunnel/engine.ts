/**
 * 隧道渲染器。
 *
 * 用命令式 three.js 而不是 R3F：这个组件自带渲染循环、尺寸/像素比管理、
 * 指针与滚轮手势、上下文丢失恢复，全部是 imperative 的时序控制，
 * 用裸 three 写反而比在 React 里对齐生命周期更清楚。
 *
 * 数据结构与算法要点：
 * 1. 场景里只有两块 quad，隧道是片元着色器解析求交算出来的，没有逐格几何体；
 * 2. 「哪一格放什么」压在一张 512×256 的 RGBA 数据纹理里，texelFetch 直取；
 * 3. 雾、运动模糊、圆角、网格线全部在着色器内完成，零后处理。
 */
import {
  Color,
  DataTexture,
  Matrix4,
  Mesh,
  NearestFilter,
  NoBlending,
  NoColorSpace,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from 'three';
import { createPhotoAtlas, type PhotoAtlas } from './atlas';
import {
  buildCellGrid,
  CELL_TEXTURE_HEIGHT,
  CELL_TEXTURE_WIDTH,
  cellOffset,
  GRID_ROWS,
  MAX_ITEMS,
} from './grid';
import {
  PLATE_FRAGMENT_SHADER,
  PLATE_VERTEX_SHADER,
  TUNNEL_FRAGMENT_SHADER,
  TUNNEL_VERTEX_SHADER,
} from './shaders';
import { createSpring, resetSpring, stepSpring, type Spring } from './spring';
import type { PassageItem } from './types';

export interface TunnelOptions {
  items: PassageItem[];
  colors: [string, string];
  backgroundColor: string;
  lanes: number;
  gap: number;
  radius: number;
  photoFill: number;
  accentFill: number;
  lineOpacity: number;
  fog: number;
  speed: number;
  boost: number;
  blur: number;
  look: number;
  fov: number;
  hover: number;
  focusOnClick: boolean;
  wheel: boolean;
  interactive: boolean;
  seed: number;
  paused: boolean;
  dpr: number;
  reduced: boolean;
  onFocusChange: (item: PassageItem | null, index: number) => void;
}

export interface TunnelHandle {
  /** 参数变化后同步（重建格子/图集、重设尺寸） */
  sync: () => void;
  close: () => void;
  travel: (cells: number) => void;
  destroy: () => void;
}

interface OptionsRef {
  current: TunnelOptions;
}

interface Anchor {
  position: Vector3;
  normal: Vector3;
  quaternion: Quaternion;
}

interface DragState {
  id: number;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  touch: boolean;
  samples: { t: number; v: number }[];
}

interface FocusState {
  wall: number;
  lane: number;
  /** 未取模的行号，用于把大图放回正确深度 */
  row: number;
  /** 取模后的行号，用于与着色器里的格子三元组匹配 */
  wrap: number;
  slot: number;
  target: number;
  aspect: Spring;
}

interface Hit {
  wall: number;
  lane: number;
  row: number;
  wrap: number;
  kind: number;
  slot: number;
  clear: number;
  /** 对应图集槽位是否已经解码完成，未完成的格子不提示可点 */
  loaded: boolean;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** 长按多少毫秒算「按住加速」 */
const HOLD_DELAY = 220;

export function createTunnel(
  host: HTMLElement,
  optionsRef: OptionsRef
): TunnelHandle | null {
  const doc = host.ownerDocument;

  /* ───────────────────────── 渲染器 ───────────────────────── */
  const canvas = doc.createElement('canvas');
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;display:block';
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }
  host.appendChild(canvas);
  renderer.setClearColor(0x000000, 0);
  const anisotropy = renderer.capabilities.getMaxAnisotropy();

  /* ───────────────────────── Uniforms ───────────────────────── */
  const fade = new Float32Array(MAX_ITEMS);
  const uniforms = {
    uResolution: { value: new Vector2(1, 1) },
    uCamera: { value: new Matrix4() },
    uProjectionInverse: { value: new Matrix4() },
    uHalf: { value: new Vector2(2.5, 1.5) },
    uTravel: { value: 0 },
    uShutter: { value: 0 },
    uSamples: { value: 1 },
    uGap: { value: 0.1 },
    uRadius: { value: 0.06 },
    uLineOpacity: { value: 0.12 },
    uLineColor: { value: new Color(1, 1, 1) },
    uFogLength: { value: 12 },
    uBackground: { value: new Vector4(0, 0, 0, 1) },
    uColorA: { value: new Color() },
    uColorB: { value: new Color() },
    uAtlas: { value: null as Texture | null },
    uCells: { value: null as DataTexture | null },
    uGrid: { value: new Vector2(1, 1) },
    uInset: { value: 0.004 },
    uLoaded: { value: fade },
    uHover: { value: new Vector4(-9, -9, -9, 0) },
    uHoverOut: { value: new Vector4(-9, -9, -9, 0) },
    uFocus: { value: new Vector4(-9, -9, -9, 0) },
    uDim: { value: 0 },
    uDpr: { value: 1 },
  };

  const tunnelMaterial = new ShaderMaterial({
    uniforms,
    vertexShader: TUNNEL_VERTEX_SHADER,
    fragmentShader: TUNNEL_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    // 预乘 alpha 直接写进画布，不再与页面做二次混合
    blending: NoBlending,
  });

  const plateUniforms = {
    uImage: { value: null as Texture | null },
    uImageAspect: { value: 1 },
    uPlaneAspect: { value: 1 },
    uRadius: { value: 0.05 },
    uOpacity: { value: 1 },
    uShade: { value: 1 },
  };

  const plateMaterial = new ShaderMaterial({
    uniforms: plateUniforms,
    vertexShader: PLATE_VERTEX_SHADER,
    fragmentShader: PLATE_FRAGMENT_SHADER,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  });

  const scene = new Scene();
  const camera = new PerspectiveCamera(72, 1, 0.05, 400);
  camera.rotation.order = 'YXZ';

  const tunnelMesh = new Mesh(new PlaneGeometry(2, 2), tunnelMaterial);
  tunnelMesh.frustumCulled = false;
  tunnelMesh.renderOrder = 0;

  const plateMesh = new Mesh(new PlaneGeometry(1, 1), plateMaterial);
  plateMesh.frustumCulled = false;
  plateMesh.renderOrder = 1;
  plateMesh.visible = false;

  scene.add(tunnelMesh, plateMesh);

  /* ───────────────────── 格子数据纹理 ───────────────────── */
  const cellData = new Uint8Array(CELL_TEXTURE_WIDTH * CELL_TEXTURE_HEIGHT * 4);
  const cellTexture = new DataTexture(
    cellData,
    CELL_TEXTURE_WIDTH,
    CELL_TEXTURE_HEIGHT,
    RGBAFormat,
    UnsignedByteType
  );
  cellTexture.minFilter = NearestFilter;
  cellTexture.magFilter = NearestFilter;
  cellTexture.generateMipmaps = false;
  cellTexture.colorSpace = NoColorSpace;
  cellTexture.needsUpdate = true;
  uniforms.uCells.value = cellTexture;

  /* ───────────────────────── 运行时状态 ───────────────────────── */
  let destroyed = false;
  let contextLost = false;
  let rafId = 0;
  let lastFrame = 0;
  let visible = true;

  let atlas: PhotoAtlas | null = null;
  const ready = new Array<boolean>(MAX_ITEMS).fill(false);

  let sizeWidth = 1;
  let sizeHeight = 1;
  let pixelRatio = 2;
  /** 上一次重算投影矩阵时的 fov / aspect，避免逐帧无谓重算 */
  let projectionFov = -1;
  let projectionAspect = -1;
  let laneCount = -1;
  let wallLaneCount = -1;
  let halfWidth = 2.5;
  let halfHeight = 1.5;

  let travel = 0;
  let currentSpeed = 0;
  let kick = 0;
  let lastWheelAt = -1e9;

  const yaw = createSpring();
  const pitch = createSpring();
  const shiftX = createSpring();
  const shiftY = createSpring();
  const boostSpring = createSpring();
  const hoverSpring = createSpring();
  const hoverOutSpring = createSpring();
  const openSpring = createSpring();
  const dimSpring = createSpring();

  const pointer = { x: 0, y: 0, inside: false };
  let drag: DragState | null = null;
  let holdTimer = 0;
  let holding = false;
  let hoverCell: { wall: number; lane: number; row: number } | null = null;
  let focus: FocusState | null = null;

  let themeKey = '';
  let cellKey = '';
  let atlasKey = '';

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;

  // 复用对象，避免逐帧分配
  const colorA = new Color();
  const colorB = new Color();
  const background = new Color();
  const backgroundSrgb = new Color();
  const anchor: Anchor = {
    position: new Vector3(),
    normal: new Vector3(),
    quaternion: new Quaternion(),
  };
  const basis = new Matrix4();
  const axisX = new Vector3();
  const axisY = new Vector3();
  const axisZ = new Vector3();
  const forward = new Vector3();
  const restPosition = new Vector3();
  const probe = new Vector3();

  /* ───────────────────────── 主题 ───────────────────────── */
  const applyTheme = (): boolean => {
    const options = optionsRef.current;
    const key = `${options.colors[0]}|${options.colors[1]}|${options.backgroundColor}`;
    if (key === themeKey) return false;
    themeKey = key;

    colorA.set(options.colors[0]);
    colorB.set(options.colors[1]);
    uniforms.uColorA.value.copy(colorA);
    uniforms.uColorB.value.copy(colorB);

    const raw = options.backgroundColor.trim().toLowerCase();
    const transparent = raw === '' || raw === 'transparent';
    background.set(transparent ? '#0a0a0a' : options.backgroundColor);
    background.getRGB(backgroundSrgb, SRGBColorSpace);
    uniforms.uBackground.value.set(
      backgroundSrgb.r,
      backgroundSrgb.g,
      backgroundSrgb.b,
      transparent ? 0 : 1
    );

    // 亮底用深色网格线，暗底用白色
    const luminance =
      0.2126 * backgroundSrgb.r +
      0.7152 * backgroundSrgb.g +
      0.0722 * backgroundSrgb.b;
    const useDark = !transparent && luminance > 0.55;
    const line = useDark ? 0 : 1;
    uniforms.uLineColor.value.setRGB(line, line, line);

    return true;
  };

  /* ───────────────────────── 尺寸与布局 ───────────────────────── */
  const resize = (): boolean => {
    const rect = host.getBoundingClientRect();
    const ratio = Math.min(
      window.devicePixelRatio || 1,
      Math.max(optionsRef.current.dpr, 0.5)
    );
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (width === sizeWidth && height === sizeHeight && ratio === pixelRatio) {
      return false;
    }
    sizeWidth = width;
    sizeHeight = height;
    pixelRatio = ratio;
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    uniforms.uResolution.value.set(width * ratio, height * ratio);
    uniforms.uDpr.value = ratio;
    return true;
  };

  const updateLayout = () => {
    const lanes = clamp(Math.round(optionsRef.current.lanes), 2, 16);
    // 侧墙按画布宽高比补齐，保证格子是方的
    const wallLanes = clamp(
      Math.round(lanes / Math.max(sizeWidth / Math.max(sizeHeight, 1), 0.2)),
      2,
      16
    );
    if (lanes === laneCount && wallLanes === wallLaneCount) return;
    laneCount = lanes;
    wallLaneCount = wallLanes;
    halfWidth = lanes / 2;
    halfHeight = wallLanes / 2;
    uniforms.uHalf.value.set(halfWidth, halfHeight);
  };

  const fogLength = () => {
    const length = 12 / clamp(optionsRef.current.fog, 0.05, 4);
    return length * Math.max(1, Math.hypot(halfWidth, halfHeight) / 2.9);
  };

  /* ───────────────────────── 格子与图集 ───────────────────────── */
  const rebuildCells = (): boolean => {
    const options = optionsRef.current;
    const count = Math.min(options.items.length, MAX_ITEMS);
    const key = `${options.photoFill}|${options.accentFill}|${options.seed}|${count}`;
    if (key === cellKey) return false;
    cellKey = key;

    const data = buildCellGrid({
      photoCount: count,
      photoFill: options.photoFill,
      accentFill: options.accentFill,
      seed: options.seed,
    });
    cellData.set(data);
    cellTexture.needsUpdate = true;
    return true;
  };

  const rebuildAtlas = (): boolean => {
    const options = optionsRef.current;
    const key = options.items
      .slice(0, MAX_ITEMS)
      .map((item) => item.src)
      .join('\0');
    if (key === atlasKey) return false;
    atlasKey = key;

    const previous = atlas;
    ready.fill(false);
    fade.fill(0);

    atlas = createPhotoAtlas({
      items: options.items,
      anisotropy,
      onTileReady: (index) => {
        ready[index] = true;
        schedule();
      },
    });
    uniforms.uAtlas.value = atlas.texture;
    uniforms.uGrid.value.set(atlas.columns, atlas.rows);
    uniforms.uInset.value = atlas.inset;

    previous?.dispose();
    return true;
  };

  /* ───────────────────────── 拾取 ───────────────────────── */
  /** 在 CPU 端复算一遍着色器的求交，得到指针下的格子 */
  const pick = (
    clientX: number,
    clientY: number,
    box: DOMRect = host.getBoundingClientRect()
  ): Hit => {
    const ndcX = ((clientX - box.left) / Math.max(box.width, 1)) * 2 - 1;
    const ndcY = -(((clientY - box.top) / Math.max(box.height, 1)) * 2 - 1);

    probe.set(ndcX, ndcY, 0.5).unproject(camera);
    const direction = probe.sub(camera.position).normalize();

    const originX = camera.position.x;
    const originY = camera.position.y;
    const originZ = camera.position.z;
    const reachX = Math.max(Math.abs(direction.x), 1e-6);
    const reachY = Math.max(Math.abs(direction.y), 1e-6);
    const tx = (halfWidth - Math.sign(direction.x) * originX) / reachX;
    const ty = (halfHeight - Math.sign(direction.y) * originY) / reachY;
    const distance = Math.min(tx, ty);

    const hitX = originX + direction.x * distance;
    const hitY = originY + direction.y * distance;
    const hitZ = originZ + direction.z * distance;

    let wall: number;
    let along: number;
    if (tx < ty) {
      wall = direction.x > 0 ? 3 : 2;
      along = hitY + halfHeight;
    } else {
      wall = direction.y > 0 ? 1 : 0;
      along = hitX + halfWidth;
    }

    const depth = travel - hitZ;
    const lane = Math.floor(along);
    const row = Math.floor(depth);
    const options = optionsRef.current;
    const inner = 0.5 - 0.5 * clamp(options.gap, 0, 0.6);
    const inside =
      Math.abs(along - lane - 0.5) <= inner &&
      Math.abs(depth - row - 0.5) <= inner;

    const wrap = ((row % GRID_ROWS) + GRID_ROWS) % GRID_ROWS;
    const offset = cellOffset(wrap, wall, lane);

    return {
      wall,
      lane,
      row,
      wrap,
      kind: inside ? cellData[offset] : 0,
      slot: cellData[offset + 1],
      clear: Math.exp(-Math.pow(distance / fogLength(), 1.5)),
      loaded: fade[cellData[offset + 1]] >= 1,
    };
  };

  /* ───────────────────────── 悬停 ───────────────────────── */
  const clearHover = () => {
    if (hoverCell) {
      uniforms.uHoverOut.value.copy(uniforms.uHover.value);
      hoverOutSpring.value = hoverSpring.value;
      hoverOutSpring.velocity = 0;
      hoverCell = null;
      hoverSpring.value = 0;
      hoverSpring.velocity = 0;
      uniforms.uHover.value.set(-9, -9, -9, 0);
    }
    host.style.cursor = '';
  };

  const updateHover = (clientX: number, clientY: number, box?: DOMRect) => {
    const options = optionsRef.current;
    if (!options.interactive || focus || drag) {
      clearHover();
      return;
    }

    const hit = pick(clientX, clientY, box);
    const target =
      hit.kind === 1 || (hit.kind === 2 && options.hover > 0) ? hit : null;
    const same =
      target &&
      hoverCell &&
      hoverCell.wall === target.wall &&
      hoverCell.lane === target.lane &&
      hoverCell.row === target.wrap;
    if (same) return;

    if (hoverCell) {
      uniforms.uHoverOut.value.copy(uniforms.uHover.value);
      hoverOutSpring.value = hoverSpring.value;
      hoverOutSpring.velocity = 0;
    }
    hoverCell = target
      ? { wall: target.wall, lane: target.lane, row: target.wrap }
      : null;
    // 预热大图纹理，点开时不用等解码
    if (target?.kind === 1) atlas?.textureFor(target.slot);
    resetSpring(hoverSpring);
    if (target) {
      uniforms.uHover.value.set(target.wall, target.lane, target.wrap, 0);
    } else {
      uniforms.uHover.value.set(-9, -9, -9, 0);
    }
    host.style.cursor =
      target &&
      target.kind === 1 &&
      target.loaded &&
      options.focusOnClick &&
      target.clear > 0.25
        ? 'pointer'
        : '';
  };

  /* ───────────────────────── 大图 ───────────────────────── */
  const emitFocus = (index: number) => {
    const options = optionsRef.current;
    const item = index >= 0 ? (options.items[index] ?? null) : null;
    options.onFocusChange(item, index);
  };

  const openFocus = (hit: Hit) => {
    const image = atlas?.textureFor(hit.slot);
    if (!image) return;
    clearHover();
    plateUniforms.uImage.value = image;
    const element = atlas?.images[hit.slot];
    plateUniforms.uImageAspect.value =
      element && element.naturalHeight > 0
        ? element.naturalWidth / element.naturalHeight
        : 1;

    focus = {
      wall: hit.wall,
      lane: hit.lane,
      row: hit.row,
      wrap: hit.wrap,
      slot: hit.slot,
      target: 1,
      aspect: createSpring(1),
    };
    resetSpring(openSpring);
    uniforms.uFocus.value.set(hit.wall, hit.lane, hit.wrap, 0);
    emitFocus(hit.slot);
    schedule();
  };

  const closeFocus = () => {
    if (!focus || focus.target === 0) return;
    focus.target = 0;
    emitFocus(-1);
    schedule();
  };

  /* ───────────────────────── 锚点 ───────────────────────── */
  /** 把「墙 + 格 + 行」换算成世界坐标的位置/朝向（与着色器同一套约定） */
  const computeAnchor = (wall: number, lane: number, row: number) => {
    const z = travel - (row + 0.5);
    if (wall === 0) {
      anchor.position.set(lane + 0.5 - halfWidth, -halfHeight + 0.002, z);
      basis.makeBasis(
        axisX.set(1, 0, 0),
        axisY.set(0, 0, -1),
        axisZ.set(0, 1, 0)
      );
    } else if (wall === 1) {
      anchor.position.set(lane + 0.5 - halfWidth, halfHeight - 0.002, z);
      basis.makeBasis(
        axisX.set(1, 0, 0),
        axisY.set(0, 0, 1),
        axisZ.set(0, -1, 0)
      );
    } else if (wall === 2) {
      anchor.position.set(-halfWidth + 0.002, lane + 0.5 - halfHeight, z);
      basis.makeBasis(
        axisX.set(0, 0, -1),
        axisY.set(0, 1, 0),
        axisZ.set(1, 0, 0)
      );
    } else {
      anchor.position.set(halfWidth - 0.002, lane + 0.5 - halfHeight, z);
      basis.makeBasis(
        axisX.set(0, 0, 1),
        axisY.set(0, 1, 0),
        axisZ.set(-1, 0, 0)
      );
    }
    anchor.normal.copy(axisZ);
    anchor.quaternion.setFromRotationMatrix(basis);
  };

  /* ───────────────────────── 渲染循环 ───────────────────────── */
  const render = (now: number) => {
    rafId = 0;
    if (destroyed || contextLost) return;

    const options = optionsRef.current;
    const reduced = reducedMotion || options.reduced;
    const dt = lastFrame ? clamp((now - lastFrame) / 1000, 0, 0.1) : 1 / 60;
    lastFrame = now;

    let dirty = false;
    if (applyTheme()) dirty = true;
    updateLayout();

    /* 1. 相机：指针驱动偏航/俯仰与视差位移，全部走弹簧 */
    const look = reduced ? 0 : clamp(options.look, 0, 3) * (focus ? 0.3 : 1);
    const pointerX = pointer.inside ? pointer.x : 0;
    const pointerY = pointer.inside ? pointer.y : 0;

    dirty = stepSpring(yaw, -0.12 * pointerX * look, dt, 1.1) || dirty;
    dirty = stepSpring(pitch, 0.08 * pointerY * look, dt, 1.1) || dirty;
    dirty =
      stepSpring(
        shiftX,
        0.16 * pointerX * halfWidth * Math.min(look, 1),
        dt,
        1.3
      ) || dirty;
    dirty =
      stepSpring(
        shiftY,
        0.16 * pointerY * halfHeight * Math.min(look, 1),
        dt,
        1.3
      ) || dirty;
    dirty =
      stepSpring(
        boostSpring,
        holding && !reduced ? 1 : 0,
        dt,
        holding ? 0.9 : 0.7
      ) || dirty;

    /* 2. 速度：巡航 → 指数逼近；长按 boost；滚轮/拖拽给冲量 */
    const wheelRecent = now - lastWheelAt < 1200;
    const cruise = reduced || focus ? 0 : options.speed;
    const target = options.paused || wheelRecent ? 0 : cruise;
    const boosted =
      target +
      (Math.max(options.boost, 1) *
        Math.max(Math.abs(cruise), 0.3) *
        Math.sign(cruise || 1) -
        target) *
        boostSpring.value *
        (reduced || focus ? 0 : 1);
    const dragging = drag?.moved ?? false;

    if (!dragging) {
      currentSpeed += (boosted - currentSpeed) * (1 - Math.exp(-dt / 0.45));
      const decay = kick * (1 - Math.exp(-dt / (reduced ? 0.02 : 0.16)));
      kick -= decay;
      if (Math.abs(kick) < 1e-4) kick = 0;
      travel += currentSpeed * dt + decay;
    }
    if (Math.abs(currentSpeed) > 1e-4 || Math.abs(boosted) > 1e-4) dirty = true;
    if (kick !== 0 || wheelRecent) dirty = true;
    travel = ((travel % GRID_ROWS) + GRID_ROWS) % GRID_ROWS;

    camera.fov = clamp(options.fov, 30, 110);
    camera.aspect = sizeWidth / Math.max(sizeHeight, 1);
    if (camera.fov !== projectionFov || camera.aspect !== projectionAspect) {
      projectionFov = camera.fov;
      projectionAspect = camera.aspect;
      camera.updateProjectionMatrix();
    }
    camera.position.set(shiftX.value, shiftY.value, 0);
    camera.rotation.set(pitch.value, yaw.value, 0, 'YXZ');
    camera.updateMatrixWorld();

    uniforms.uCamera.value.copy(camera.matrixWorld);
    uniforms.uProjectionInverse.value.copy(camera.projectionMatrixInverse);
    uniforms.uTravel.value = travel;

    /* 3. 运动模糊：快门量决定采样数，最多 12 次 */
    const blurAmount = reduced ? 0 : clamp(options.blur, 0, 3);
    const shutter = Math.min(0.03 * Math.abs(currentSpeed) * blurAmount, 0.9);
    uniforms.uShutter.value = shutter * Math.sign(currentSpeed || 1);
    uniforms.uSamples.value =
      shutter > 0.03 ? Math.min(12, Math.ceil(shutter / 0.05) + 2) : 1;

    uniforms.uGap.value = clamp(options.gap, 0, 0.6);
    uniforms.uRadius.value = clamp(options.radius, 0, 1);
    uniforms.uLineOpacity.value = clamp(options.lineOpacity, 0, 1);
    uniforms.uFogLength.value = fogLength();

    /* 4. 图集逐张淡入 */
    for (let i = 0; i < MAX_ITEMS; i += 1) {
      if (!ready[i] || fade[i] >= 1) continue;
      fade[i] = reduced ? 1 : Math.min(1, fade[i] + dt / 0.6);
      dirty = true;
    }

    /* 5. 悬停提亮 */
    dirty =
      stepSpring(
        hoverSpring,
        hoverCell ? clamp(options.hover, 0, 2) : 0,
        dt,
        0.35
      ) || dirty;
    dirty = stepSpring(hoverOutSpring, 0, dt, 0.35) || dirty;
    uniforms.uHover.value.w = Math.max(hoverSpring.value, 0);
    uniforms.uHoverOut.value.w = Math.max(hoverOutSpring.value, 0);

    /* 6. 打开的大图：从墙面飞到相机前 */
    if (focus) {
      const image = atlas?.textureFor(focus.slot) ?? null;
      if (image && plateUniforms.uImage.value !== image) {
        plateUniforms.uImage.value = image;
      }

      dirty =
        stepSpring(openSpring, focus.target, dt, reduced ? 0.12 : 0.7) || dirty;
      dirty = stepSpring(dimSpring, 0.72 * focus.target, dt, 0.7) || dirty;
      dirty =
        stepSpring(
          focus.aspect,
          focus.target > 0 ? plateUniforms.uImageAspect.value : 1,
          dt,
          0.9
        ) || dirty;

      const blend = clamp(openSpring.value, 0, 1);
      computeAnchor(focus.wall, focus.lane, focus.row);

      const frameHeight = 4.4 * Math.tan((camera.fov * Math.PI) / 360);
      const frameWidth = frameHeight * camera.aspect;
      const imageAspect = plateUniforms.uImageAspect.value;
      const planeAspect = clamp(
        focus.aspect.value,
        Math.min(1, imageAspect),
        Math.max(1, imageAspect)
      );

      forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
      restPosition.copy(camera.position).addScaledVector(forward, 2.2);

      let height = 0.66 * frameHeight;
      let width = height * imageAspect;
      if (width > 0.82 * frameWidth) {
        width = 0.82 * frameWidth;
        height = width / imageAspect;
      }
      const compact = 1 - clamp(options.gap, 0, 0.6);
      const size =
        (compact + (Math.sqrt(width * height) - compact) * blend) /
        Math.sqrt(planeAspect);

      plateMesh.position.lerpVectors(anchor.position, restPosition, blend);
      // 中途轻微推离墙面，飞行轨迹带一点弧线
      plateMesh.position.addScaledVector(
        anchor.normal,
        0.35 * Math.sin(Math.PI * blend)
      );
      plateMesh.quaternion.slerpQuaternions(
        anchor.quaternion,
        camera.quaternion,
        blend
      );
      plateMesh.scale.set(size * planeAspect, size, 1);
      plateMesh.visible = blend > 0.0005 || focus.target > 0;

      plateUniforms.uPlaneAspect.value = planeAspect;
      const radiusBase =
        Math.min(0.5 * clamp(options.radius, 0, 1), 0.5 * compact) / compact;
      plateUniforms.uRadius.value = radiusBase + (0.018 - radiusBase) * blend;
      const clear = Math.exp(
        -Math.pow(
          anchor.position.distanceTo(camera.position) / fogLength(),
          1.5
        )
      );
      plateUniforms.uShade.value =
        (0.88 + 0.12 * blend) *
        (clear + (1 - clear) * blend) *
        (1 - dimSpring.value * (1 - blend));
      plateUniforms.uOpacity.value = 1;

      uniforms.uFocus.value.w =
        focus.target > 0 || openSpring.value > 0.002 ? 1 : 0;
      uniforms.uDim.value = dimSpring.value;

      if (
        focus.target === 0 &&
        openSpring.value <= 0.002 &&
        Math.abs(openSpring.velocity) < 0.02
      ) {
        focus = null;
        resetSpring(openSpring);
        plateMesh.visible = false;
        uniforms.uFocus.value.set(-9, -9, -9, 0);
      }
    } else {
      dirty = stepSpring(dimSpring, 0, dt, 0.7) || dirty;
      uniforms.uDim.value = Math.max(dimSpring.value, 0);
    }

    renderer.render(scene, camera);
    if (dirty) schedule();
  };

  function schedule() {
    if (rafId || destroyed || contextLost || !visible) return;
    rafId = requestAnimationFrame(render);
  }

  /* ───────────────────────── 手势 ───────────────────────── */
  const onPointerDown = (event: PointerEvent) => {
    if (!optionsRef.current.interactive) return;
    if (!event.isPrimary || event.button > 0) return;

    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      touch: event.pointerType === 'touch',
      samples: [],
    };
    if (event.pointerType !== 'touch') {
      try {
        host.setPointerCapture(event.pointerId);
      } catch {
        /* 某些浏览器在合成事件上会抛错，忽略即可 */
      }
    }

    window.clearTimeout(holdTimer);
    if (!focus) {
      holdTimer = window.setTimeout(() => {
        if (drag && !drag.moved && !focus) {
          holding = true;
          clearHover();
          schedule();
        }
      }, HOLD_DELAY);
    }
    schedule();
  };

  const onPointerMove = (event: PointerEvent) => {
    const options = optionsRef.current;
    if (!options.interactive) return;

    // 一次事件只读一次布局：指针位置与拾取共用同一个矩形
    const box =
      event.pointerType !== 'touch' ? host.getBoundingClientRect() : null;
    if (box) {
      pointer.inside = true;
      pointer.x = clamp(
        ((event.clientX - box.left) / Math.max(box.width, 1)) * 2 - 1,
        -1,
        1
      );
      pointer.y = clamp(
        -(((event.clientY - box.top) / Math.max(box.height, 1)) * 2 - 1),
        -1,
        1
      );
    }

    if (drag && drag.id === event.pointerId) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 6) {
        drag.moved = true;
        window.clearTimeout(holdTimer);
        holding = false;
      }
      if (drag.moved && !focus) {
        // 鼠标竖直拖、触摸横向拖，都换算成「格」
        const delta =
          ((drag.touch
            ? event.clientX - drag.lastX
            : event.clientY - drag.lastY) /
            Math.max(sizeHeight, 1)) *
          6 *
          (drag.touch ? -1 : 1);
        travel += delta;
        const stamp = performance.now();
        drag.samples.push({ t: stamp, v: delta });
        while (drag.samples.length && stamp - drag.samples[0].t > 90) {
          drag.samples.shift();
        }
      }
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
    } else if (box) {
      updateHover(event.clientX, event.clientY, box);
    }

    schedule();
  };

  const endPointer = (event: PointerEvent, cancelled: boolean) => {
    if (!drag || drag.id !== event.pointerId) return;
    const state = drag;
    drag = null;
    window.clearTimeout(holdTimer);
    const wasHolding = holding;
    holding = false;

    try {
      if (host.hasPointerCapture(event.pointerId)) {
        host.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* 同上 */
    }

    if (state.moved && !focus) {
      // 松手时用最近 90ms 的采样推算甩动速度
      const stamp = performance.now();
      const recent = state.samples.filter((sample) => stamp - sample.t < 90);
      if (recent.length > 1) {
        const span = Math.max(
          (recent[recent.length - 1].t - recent[0].t) / 1000,
          1 / 60
        );
        const total = recent.reduce((sum, sample) => sum + sample.v, 0);
        currentSpeed = clamp(total / span, -40, 40);
      }
    } else if (!cancelled && !state.moved && !wasHolding) {
      if (focus) {
        closeFocus();
      } else if (optionsRef.current.focusOnClick) {
        const hit = pick(event.clientX, event.clientY);
        if (hit.kind === 1 && hit.clear > 0.25) openFocus(hit);
      }
    }

    if (event.pointerType !== 'touch') {
      updateHover(event.clientX, event.clientY);
    }
    schedule();
  };

  const onPointerUp = (event: PointerEvent) => endPointer(event, false);
  const onPointerCancel = (event: PointerEvent) => endPointer(event, true);

  const onPointerLeave = (event: PointerEvent) => {
    if (drag && drag.id === event.pointerId) return;
    pointer.inside = false;
    clearHover();
    schedule();
  };

  const onWheel = (event: WheelEvent) => {
    const options = optionsRef.current;
    if (!options.wheel || !options.interactive) return;
    event.preventDefault();
    const scale =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? sizeHeight : 1;
    const delta = clamp((event.deltaY + event.deltaX) * scale, -240, 240);

    if (focus && focus.target === 1) closeFocus();
    kick += 0.012 * delta;
    lastWheelAt = performance.now();
    schedule();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!optionsRef.current.interactive) return;
    if (event.key === 'Escape') {
      closeFocus();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      kick += 1.5;
      schedule();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      kick -= 1.5;
      schedule();
    }
  };

  const onMotionPreference = () => {
    reducedMotion = motionQuery.matches;
    schedule();
  };

  const onContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };

  const onContextRestored = () => {
    contextLost = false;
    lastFrame = 0;
    // 强制重建所有 GPU 资源
    themeKey = '';
    cellKey = '';
    atlasKey = '';
    handle.sync();
  };

  host.addEventListener('pointerdown', onPointerDown);
  host.addEventListener('pointermove', onPointerMove);
  host.addEventListener('pointerup', onPointerUp);
  host.addEventListener('pointercancel', onPointerCancel);
  host.addEventListener('pointerleave', onPointerLeave);
  host.addEventListener('wheel', onWheel, { passive: false });
  host.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  motionQuery.addEventListener('change', onMotionPreference);

  const resizeObserver = new ResizeObserver(() => {
    if (resize()) schedule();
  });
  resizeObserver.observe(host);

  // 离屏时停掉渲染循环
  const intersectionObserver =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(
          ([entry]) => {
            visible = entry.isIntersecting;
            if (visible) {
              lastFrame = 0;
              schedule();
            } else if (rafId) {
              cancelAnimationFrame(rafId);
              rafId = 0;
            }
          },
          { rootMargin: '80px' }
        );
  if (intersectionObserver) {
    intersectionObserver.observe(host);
  } else {
    visible = true;
  }

  /* ───────────────────────── 初始化 ───────────────────────── */
  resize();
  updateLayout();
  applyTheme();
  rebuildCells();
  rebuildAtlas();
  schedule();

  const handle: TunnelHandle = {
    sync: () => {
      resize();
      rebuildCells();
      rebuildAtlas();
      if (focus && focus.slot >= optionsRef.current.items.length) closeFocus();
      lastFrame = 0;
      schedule();
    },
    close: closeFocus,
    travel: (cells: number) => {
      currentSpeed += 2 * cells;
      schedule();
    },
    destroy: () => {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      window.clearTimeout(holdTimer);
      intersectionObserver?.disconnect();
      resizeObserver.disconnect();
      motionQuery.removeEventListener('change', onMotionPreference);
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerup', onPointerUp);
      host.removeEventListener('pointercancel', onPointerCancel);
      host.removeEventListener('pointerleave', onPointerLeave);
      host.removeEventListener('wheel', onWheel);
      host.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      host.style.cursor = '';
      atlas?.dispose();
      atlas = null;
      cellTexture.dispose();
      tunnelMesh.geometry.dispose();
      tunnelMaterial.dispose();
      plateMesh.geometry.dispose();
      plateMaterial.dispose();
      renderer.dispose();
      if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
      canvas.remove();
    },
  };

  return handle;
}
