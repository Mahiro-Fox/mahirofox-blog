/**
 * Passage Gallery 的着色器。
 *
 * 隧道不是几何体摆出来的：场景里只有一个全屏面片，片元着色器把每个像素
 * 反投影成一条射线，与「矩形管道」的四壁做解析求交，得到墙面坐标后
 * 再去查格子纹理。因此没有顶点开销，也没有后处理。
 */

/** 全屏面片顶点着色器：直接输出裁剪空间坐标，绕开相机矩阵。 */
export const TUNNEL_VERTEX_SHADER = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * 隧道片元着色器。
 *
 * 约定：
 * - 所有颜色都在 sRGB 编码空间里运算与输出（图集纹理按 NoColorSpace 上传，
 *   不再做硬件解码），因此最终颜色可以直接写进画布；
 * - 输出是**预乘 alpha**，配合材质 NoBlending + 画布 premultipliedAlpha，
 *   画面会自己叠到宿主页面上，backgroundColor="transparent" 天然可用。
 */
export const TUNNEL_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform vec2 uResolution;
uniform mat4 uCamera;
uniform mat4 uProjectionInverse;
uniform vec2 uHalf;
uniform float uTravel;
uniform float uShutter;
uniform float uSamples;
uniform float uGap;
uniform float uRadius;
uniform float uLineOpacity;
uniform vec3 uLineColor;
uniform float uFogLength;
uniform vec4 uBackground;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform sampler2D uAtlas;
uniform sampler2D uCells;
uniform vec2 uGrid;
uniform float uInset;
uniform float uLoaded[48];
uniform vec4 uHover;
uniform vec4 uHoverOut;
uniform vec4 uFocus;
uniform float uDim;
uniform float uDpr;

/* 格子表在纵向上是周期性的：走出 2048 行会回到同一批数据，隧道因此无限长。 */
const float ROWS = 2048.0;

vec3 rgbToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(max(l, 0.0), 1.0 / 3.0);
  m = pow(max(m, 0.0), 1.0 / 3.0);
  s = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  );
}

vec3 oklabToRgb(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

/* 线性 -> sRGB（强调色块在 oklab 里插值，回来时要落到编码空间） */
vec3 encodeSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

/* 圆角矩形 SDF */
float roundedBox(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

bool isCell(vec4 slot, float wall, float lane, float row) {
  return abs(slot.x - wall) < 0.5 && abs(slot.y - lane) < 0.5 && abs(slot.z - row) < 0.5;
}

/**
 * 取墙面上的一个采样点（连续坐标 cont = 沿墙坐标 + 沿隧道坐标）。
 * footprint 是 cont 在屏幕上的导数长度，用来做抗锯齿与网格线淡出。
 */
vec4 shadeSurface(float wall, vec2 cont, vec2 footprint, vec2 ddx, vec2 ddy) {
  float lane = floor(cont.x);
  float row = mod(floor(cont.y), ROWS);
  vec2 cell = fract(cont);

  /* 网格线：用「到格子边的像素距离」判定，格子透视缩小后自动淡出，避免摩尔纹 */
  vec2 edge = min(cell, 1.0 - cell) / max(footprint, vec2(1e-5));
  float cellPx = 1.0 / max(max(footprint.x, footprint.y), 1e-5);
  float halfWidth = 0.5 * uDpr;
  float line = 1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, min(edge.x, edge.y));
  line *= smoothstep(4.0, 16.0, cellPx / uDpr) * uLineOpacity;
  vec4 grid = vec4(uLineColor * line, line);

  int index = (int(row) * 4 + int(wall)) * 16 + int(clamp(lane, 0.0, 15.0));
  vec4 info = texelFetch(uCells, ivec2(index % 512, index / 512), 0);
  float kind = floor(info.r * 255.0 + 0.5);
  if (kind < 0.5) return grid;

  /* 悬停与「被点开」两种状态都要按格子三元组匹配 */
  float hover = 0.0;
  if (isCell(uHover, wall, lane, row)) hover = uHover.w;
  if (isCell(uHoverOut, wall, lane, row)) hover = max(hover, uHoverOut.w);
  float vacant = isCell(uFocus, wall, lane, row) ? uFocus.w : 0.0;

  float halfSize = 0.5 - uGap * 0.5;
  float grow = hover * min(uGap * 0.35, 0.03);
  vec2 local = cell - 0.5;
  float d = roundedBox(local, vec2(halfSize + grow), min(uRadius * 0.5, halfSize));
  float aa = max(footprint.x, footprint.y) * 0.75;
  float cover = (1.0 - smoothstep(-aa, aa, d)) * (1.0 - vacant);

  vec3 color;
  if (kind < 1.5) {
    /* 照片：从图集里取一块，四个墙面各自做旋转/翻转保证图是正的 */

    /*
     * 槽位行列必须用整数运算。GPU 的 float 除法/取模对「整除」不精确：
     * slot 恰为列数整数倍时，mod(7.0, 7.0) 可能算出 6.996、floor(7.0/7.0)
     * 可能算出 0。前者会把 UV 推到图集最右侧（clamp 成一条纹），
     * 表现为整块照片变成横向条纹。改用 int 运算后商与余数都精确。
     */
    int slotIndex = int(info.g * 255.0 + 0.5);
    float span = 2.0 * (halfSize + grow);
    vec2 uv = local / span + 0.5;
    vec2 uvDx = ddx / span;
    vec2 uvDy = ddy / span;

    if (wall > 0.5 && wall < 1.5) {
      uv.y = 1.0 - uv.y;
    } else if (wall > 1.5 && wall < 2.5) {
      uv = uv.yx;
      uvDx = uvDx.yx;
      uvDy = uvDy.yx;
    } else if (wall > 2.5) {
      uv = vec2(1.0 - uv.y, uv.x);
      uvDx = uvDx.yx;
      uvDy = uvDy.yx;
    }
    uv = clamp(uv, 0.0, 1.0);

    int columns = max(int(uGrid.x + 0.5), 1);
    int slotRow = slotIndex / columns;
    vec2 cellSlot = vec2(float(slotIndex - slotRow * columns), float(slotRow));
    float inner = 1.0 - 2.0 * uInset;
    vec2 atlasUv = vec2(
      (cellSlot.x + uInset + uv.x * inner) / uGrid.x,
      1.0 - (cellSlot.y + uInset + (1.0 - uv.y) * inner) / uGrid.y
    );
    vec2 scale = vec2(inner) / uGrid;
    vec3 image = textureGrad(uAtlas, atlasUv, uvDx * scale, uvDy * scale).rgb;

    /* 图还没解码完时用占位色，避免出现黑洞 */
    float loaded = uLoaded[slotIndex];
    vec3 placeholder = mix(uBackground.rgb, uLineColor, 0.06);
    color = mix(placeholder, image, loaded) * (0.88 + 0.22 * hover);
  } else {
    /* 强调色块：两端色在 oklab 里插值，观感比直接 mix RGB 干净 */
    vec2 tone = local / (2.0 * halfSize) + 0.5;
    float t = clamp(info.b * 0.55 + (tone.x * 0.6 + tone.y * 0.4) * 0.45, 0.0, 1.0);
    color = encodeSrgb(max(oklabToRgb(mix(rgbToOklab(uColorA), rgbToOklab(uColorB), t)), 0.0));
    color *= 0.86 + 0.18 * hover;
  }

  return vec4(color * cover, cover) + grid * (1.0 - cover);
}

void main() {
  vec2 ndc = gl_FragCoord.xy / uResolution * 2.0 - 1.0;
  vec4 viewPoint = uProjectionInverse * vec4(ndc, 1.0, 1.0);
  vec3 dir = normalize((uCamera * vec4(viewPoint.xyz / viewPoint.w, 0.0)).xyz);
  vec3 origin = uCamera[3].xyz;

  /* 与四面墙求交，取先撞到的那一面 */
  vec2 reach = max(abs(dir.xy), vec2(1e-6));
  float tx = (uHalf.x - sign(dir.x) * origin.x) / reach.x;
  float ty = (uHalf.y - sign(dir.y) * origin.y) / reach.y;
  float hitT = min(tx, ty);
  vec3 hit = origin + dir * hitT;

  float wall;
  vec2 cont;
  if (tx < ty) {
    wall = dir.x > 0.0 ? 3.0 : 2.0;
    cont = vec2(hit.y + uHalf.y, uTravel - hit.z);
  } else {
    wall = dir.y > 0.0 ? 1.0 : 0.0;
    cont = vec2(hit.x + uHalf.x, uTravel - hit.z);
  }

  vec2 ddx = dFdx(cont);
  vec2 ddy = dFdy(cont);
  vec2 footprint = sqrt(ddx * ddx + ddy * ddy);

  /* 运动模糊：沿行进轴偏移连续坐标多次采样，抖动用 Bayer 式哈希打散 */
  float count = max(uSamples, 1.0);
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec4 content = vec4(0.0);
  for (int i = 0; i < 12; i++) {
    if (float(i) >= count) break;
    float offset = count > 1.0 ? ((float(i) + jitter) / count - 0.5) * uShutter : 0.0;
    content += shadeSurface(wall, cont + vec2(0.0, offset), footprint, ddx, ddy);
  }
  content /= count;

  /* 解析雾：距离越远越融进背景色，不需要深度缓冲 */
  float haze = 1.0 - exp(-pow(hitT / uFogLength, 1.5));
  content *= (1.0 - haze) * (1.0 - uDim);

  float alpha = content.a + uBackground.a * (1.0 - content.a);
  vec3 color = content.rgb + uBackground.rgb * uBackground.a * (1.0 - content.a);
  gl_FragColor = vec4(color, alpha);
}
`;

/** 单张照片的顶点着色器（贴在飞行大图上）。 */
export const PLATE_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** 单张照片的片元着色器：圆角 + 等比裁切 + 整体明暗。 */
export const PLATE_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform sampler2D uImage;
uniform float uImageAspect;
uniform float uPlaneAspect;
uniform float uRadius;
uniform float uOpacity;
uniform float uShade;
varying vec2 vUv;

float roundedBox(vec2 p, vec2 halfSize, float r) {
  vec2 q = abs(p) - halfSize + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uPlaneAspect, 1.0);
  float d = roundedBox(p, vec2(uPlaneAspect, 1.0) * 0.5, uRadius);
  float aa = fwidth(d);
  float cover = 1.0 - smoothstep(-aa, aa, d);

  vec2 uv = vUv - 0.5;
  if (uPlaneAspect < uImageAspect) {
    uv.x *= uPlaneAspect / uImageAspect;
  } else {
    uv.y *= uImageAspect / uPlaneAspect;
  }

  vec3 color = texture2D(uImage, uv + 0.5).rgb * uShade;
  float alpha = cover * uOpacity;
  gl_FragColor = vec4(color * alpha, alpha);
}
`;
