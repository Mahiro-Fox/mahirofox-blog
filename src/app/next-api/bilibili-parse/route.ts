import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/utils/logger';

const logger = createLogger('BilibiliParse');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ==================== 类型定义 ==================== */

export interface VideoParseResult {
  type: 'video';
  title: string;
  cover: string;
  mp4Url: string;
  duration: number;
  fileSize: number;
  quality: number;
  format: string;
  acceptDescription: string[];
  supportFormats: Array<{
    quality: number;
    format: string;
    description: string;
    displayDesc: string;
  }>;
  /** 当前分P序号（从 1 开始） */
  page: number;
  /** 总分P数 */
  totalPages: number;
  /** 当前分P标题 */
  partTitle: string;
  /**
   * 独立音轨（DASH，取可用音轨中质量最高的一条）。
   * 解析失败或该视频无独立音轨时为 null，不影响视频解析结果。
   */
  audio: AudioParseResult | null;
}

/** DASH 单独音轨信息 */
export interface AudioParseResult {
  /** 音频直链（.m4s / .flac，浏览器可直接下载） */
  url: string;
  /** B 站音频流 id：30216(64K) / 30232(132K) / 30280(192K) / 30250(Dolby) / 30251(Hi-Res) */
  id: number;
  /** 质量描述，如 192K / Dolby Atmos / Hi-Res Lossless */
  qualityLabel: string;
  /** 码率（bit/s） */
  bandwidth: number;
  /** MIME 类型，如 audio/mp4 */
  mimeType: string;
  /** 编码，如 mp4a.40.2 / fLaC */
  codecs: string;
  /** 预估文件大小（字节） */
  fileSize: number;
}

export interface LiveParseResult {
  type: 'live';
  /** 直播间号 */
  roomId: number;
  /** HLS 直播流地址（.m3u8） */
  m3u8Url: string;
  /** 流格式名，如 ts / fmp4 */
  formatName: string;
  /** 编码名，如 avc / hevc */
  codecName: string;
}

export type ParseResult = VideoParseResult | LiveParseResult;

type ParseSuccess<T> = { success: true; data: T };
type ParseFailure = { success: false; error: string; status: number };
type VideoOutcome = ParseSuccess<VideoParseResult> | ParseFailure;
type LiveOutcome = ParseSuccess<LiveParseResult> | ParseFailure;

/* ==================== B 站接口响应类型 ==================== */

interface BilibiliPage {
  cid: number;
  page: number;
  part: string;
  duration: number;
}

interface BilibiliViewResponse {
  code: number;
  message: string;
  data: {
    bvid: string;
    cid: number;
    title: string;
    pic: string;
    videos: number;
    pages: BilibiliPage[];
  };
}

interface BilibiliPlayurlResponse {
  code: number;
  message: string;
  data: {
    quality: number;
    format: string;
    timelength: number;
    accept_description: string[];
    durl: Array<{ order: number; length: number; size: number; url: string }>;
    support_formats: Array<{
      quality: number;
      format: string;
      new_description: string;
      display_desc: string;
    }>;
  };
}

interface BilibiliLiveCodec {
  codec_name: string;
  base_url: string;
  url_info: Array<{ host: string; extra: string }>;
}

interface BilibiliLiveFormat {
  format_name: string;
  codec: BilibiliLiveCodec[];
}

interface BilibiliLiveStream {
  protocol_name: string;
  format: BilibiliLiveFormat[];
}

interface BilibiliLiveResponse {
  code: number;
  message: string;
  data: {
    room_id: number;
    live_status: number;
    playurl_info: { playurl: { stream: BilibiliLiveStream[] } } | null;
  };
}

/** DASH 音轨条目（B 站同时返回驼峰与下划线两套字段，兼容取用） */
interface BilibiliDashAudio {
  id?: number;
  baseUrl?: string;
  base_url?: string;
  backupUrl?: string[];
  backup_url?: string[];
  bandwidth?: number;
  mimeType?: string;
  mime_type?: string;
  codecs?: string;
}

interface BilibiliDashResponse {
  code: number;
  message: string;
  data: {
    dash?: {
      /** 时长（秒） */
      duration?: number;
      audio?: BilibiliDashAudio[];
      dolby?: { audio: BilibiliDashAudio | null } | null;
      flac?: { audio: BilibiliDashAudio | null } | null;
    };
  };
}

/** 音频流 id → 可读质量标签 */
const AUDIO_QUALITY_LABELS: Record<number, string> = {
  30216: '64K',
  30232: '132K',
  30280: '192K',
  30250: 'Dolby Atmos',
  30251: 'Hi-Res Lossless',
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/* ==================== URL 匹配辅助 ==================== */

/** 是否直播链接（live.bilibili.com） */
function isLiveUrl(input: string): boolean {
  return /live\.bilibili\.com\//.test(input);
}

/** 提取直播间号，兼容 live.bilibili.com/123 与 live.bilibili.com/blanc/123 */
function extractLiveRoomId(input: string): string | null {
  return input.match(/live\.bilibili\.com\/(?:blanc\/)?(\d+)/)?.[1] ?? null;
}

/** 从原始输入中尝试解析分P号（支持完整 URL、BV号+?p=、裸 ?p= 查询串） */
function extractPageFromInput(raw: string): number | null {
  try {
    const normalized = raw.startsWith('http')
      ? raw
      : `https://www.bilibili.com/video/${raw}`;
    const p = new URL(normalized).searchParams.get('p');
    if (p) {
      const n = Number.parseInt(p, 10);
      if (Number.isFinite(n)) return n;
    }
  } catch {
    // 忽略 URL 解析失败，走下方正则兜底
  }
  const m = raw.match(/[?&]p=(\d+)/);
  if (m) return Number.parseInt(m[1], 10);
  return null;
}

/* ==================== 音频解析（DASH 独立音轨） ==================== */

/**
 * 解析独立音轨。
 *
 * 视频直链走的是 `platform=html5`（音视频合一的 durl），该平台参数**不会**返回
 * DASH 数据，所以音轨必须单独用 `fnval=16` 再请求一次 playurl。
 * 这里只关心 audio：flac / dolby 若存在则一并参与比较，最终按码率取最高。
 *
 * 任何失败都返回 null —— 音频是附加能力，不能影响视频解析主流程。
 *
 * @param durationMs 兜底时长（毫秒），dash.duration 缺失时用于估算文件大小
 */
async function parseBilibiliAudio(
  bvid: string,
  cid: number,
  durationMs: number
): Promise<AudioParseResult | null> {
  try {
    const api =
      `https://api.bilibili.com/x/player/wbi/playurl` +
      `?bvid=${bvid}&cid=${cid}&fnval=16&fnver=0&fourk=1`;
    const res = await fetch(api, {
      headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com' },
    });
    if (!res.ok) return null;

    const json = (await res.json()) as BilibiliDashResponse;
    if (json.code !== 0 || !json.data?.dash) return null;

    const { dash } = json.data;

    // flac / dolby 的 audio 自身不带 id，按官方约定补上
    const candidates: Array<{ stream: BilibiliDashAudio; id: number }> = [];
    if (dash.flac?.audio)
      candidates.push({ stream: dash.flac.audio, id: 30251 });
    if (dash.dolby?.audio)
      candidates.push({ stream: dash.dolby.audio, id: 30250 });
    for (const stream of dash.audio ?? []) {
      candidates.push({ stream, id: stream.id ?? 0 });
    }

    const usable = candidates
      .map(({ stream, id }) => ({
        id: stream.id ?? id,
        url: stream.baseUrl ?? stream.base_url ?? '',
        stream,
      }))
      .filter((item) => item.url);

    if (usable.length === 0) return null;

    // 码率最高的即质量最高（flac ≈1411K 会自然排在最前）
    usable.sort(
      (a, b) => (b.stream.bandwidth ?? 0) - (a.stream.bandwidth ?? 0)
    );
    const best = usable[0];
    const bandwidth = best.stream.bandwidth ?? 0;
    const durationSec = dash.duration ?? durationMs / 1000;

    return {
      url: best.url,
      id: best.id,
      qualityLabel:
        AUDIO_QUALITY_LABELS[best.id] ??
        (bandwidth > 0 ? `${Math.round(bandwidth / 1000)}K` : 'Audio'),
      bandwidth,
      mimeType: best.stream.mimeType ?? best.stream.mime_type ?? 'audio/mp4',
      codecs: best.stream.codecs ?? '',
      fileSize: bandwidth > 0 ? Math.round((bandwidth * durationSec) / 8) : 0,
    };
  } catch (error) {
    logger.warn('B 站音频解析失败（已忽略）', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/* ==================== 视频解析（支持分P） ==================== */

async function parseBilibiliVideo(
  url: string,
  pParam?: string | null
): Promise<VideoOutcome> {
  const bvid = url.match(/(BV[a-zA-Z0-9]{10})/)?.[1];

  if (!bvid) {
    return {
      success: false,
      status: 400,
      error: '无法从 URL 中提取 BV 号，请检查链接格式',
    };
  }

  // 确定目标分P：显式 p 参数优先，其次从 url 中解析，默认第 1P
  let pageNum = 1;
  if (pParam != null && pParam !== '') {
    const n = Number.parseInt(pParam, 10);
    if (!Number.isFinite(n) || n < 1) {
      return {
        success: false,
        status: 400,
        error: 'p 参数必须为大于等于 1 的整数',
      };
    }
    pageNum = n;
  } else {
    const fromUrl = extractPageFromInput(url);
    if (fromUrl != null) {
      if (fromUrl < 1) {
        return {
          success: false,
          status: 400,
          error: 'p 参数必须为大于等于 1 的整数',
        };
      }
      pageNum = fromUrl;
    }
  }

  try {
    // 步骤一：获取视频基本信息（含分集列表 pages）
    const viewApiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    // 注意：机房 IP 携带浏览器 UA 会被 B 站风控拦截（412），此处不要伪装 Chrome UA
    const viewRes = await fetch(viewApiUrl, {
      headers: { Referer: 'https://www.bilibili.com' },
    });

    if (!viewRes.ok) {
      return {
        success: false,
        status: 502,
        error: '获取视频信息失败，B 站接口返回错误',
      };
    }

    const viewData = (await viewRes.json()) as BilibiliViewResponse;
    if (viewData.code !== 0) {
      return {
        success: false,
        status: 502,
        error: `B 站接口返回错误: ${viewData.message}`,
      };
    }

    const { title, pic, pages, cid: firstCid } = viewData.data;

    const pageList: BilibiliPage[] =
      Array.isArray(pages) && pages.length > 0
        ? pages
        : [{ cid: firstCid, page: 1, part: 'P1', duration: 0 }];

    const totalPages = pageList.length;

    if (pageNum > totalPages) {
      return {
        success: false,
        status: 400,
        error: `p 参数超出范围，该视频共有 ${totalPages} 个分集`,
      };
    }

    const targetPage =
      pageList.find((pg) => pg.page === pageNum) ?? pageList[pageNum - 1];
    const cid = targetPage.cid;

    // 步骤二：用目标分P的 cid 获取 MP4 直链（音视频合一）
    // 同时并行请求 DASH 音轨，避免串行多一次 RTT
    const audioPromise = parseBilibiliAudio(
      bvid,
      cid,
      (targetPage.duration || 0) * 1000
    );
    const playurlApiUrl = `https://api.bilibili.com/x/player/wbi/playurl?bvid=${bvid}&cid=${cid}&qn=80&fnval=0&fnver=0&fourk=1&platform=html5`;
    const playurlRes = await fetch(playurlApiUrl, {
      headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com' },
    });

    if (!playurlRes.ok) {
      return {
        success: false,
        status: 502,
        error: '获取播放地址失败，B 站接口返回错误',
      };
    }

    const playurlData = (await playurlRes.json()) as BilibiliPlayurlResponse;
    if (playurlData.code !== 0) {
      return {
        success: false,
        status: 502,
        error: `B 站播放接口返回错误: ${playurlData.message}`,
      };
    }

    if (!playurlData.data.durl || playurlData.data.durl.length === 0) {
      return {
        success: false,
        status: 502,
        error: '未获取到视频播放地址，可能该视频需要特殊权限或已失效',
      };
    }

    const mp4Url = playurlData.data.durl[0].url;
    const audio = await audioPromise;

    return {
      success: true,
      data: {
        type: 'video',
        title,
        cover: pic,
        mp4Url,
        duration: playurlData.data.timelength,
        fileSize: playurlData.data.durl[0].size,
        quality: playurlData.data.quality,
        format: playurlData.data.format,
        acceptDescription: playurlData.data.accept_description ?? [],
        supportFormats: (playurlData.data.support_formats ?? []).map((fmt) => ({
          quality: fmt.quality,
          format: fmt.format,
          description: fmt.new_description,
          displayDesc: fmt.display_desc,
        })),
        page: pageNum,
        totalPages,
        partTitle: targetPage.part,
        audio,
      },
    };
  } catch (error) {
    logger.error('B 站视频解析失败', error);
    return { success: false, status: 500, error: '服务器内部错误，请稍后重试' };
  }
}

/* ==================== 直播解析 ==================== */

async function parseBilibiliLive(raw: string): Promise<LiveOutcome> {
  const roomId = extractLiveRoomId(raw);
  if (!roomId) {
    return {
      success: false,
      status: 400,
      error: '无法从 URL 中提取直播间号，请检查链接格式',
    };
  }

  try {
    const api =
      `https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo` +
      `?room_id=${roomId}&protocol=0,1&format=0,1,2&codec=0,1&qn=10000&platform=web`;

    const res = await fetch(api, {
      headers: { 'User-Agent': UA, Referer: 'https://live.bilibili.com' },
    });

    if (!res.ok) {
      return {
        success: false,
        status: 502,
        error: '获取直播信息失败，B 站接口返回错误',
      };
    }

    const data = (await res.json()) as BilibiliLiveResponse;
    if (data.code !== 0) {
      return {
        success: false,
        status: 502,
        error: `B 站直播接口返回错误: ${data.message}`,
      };
    }

    const roomInfo = data.data;

    if (roomInfo.live_status === 0) {
      return { success: false, status: 400, error: '该直播间当前未开播' };
    }
    if (!roomInfo.playurl_info) {
      return {
        success: false,
        status: 502,
        error: '未获取到直播流信息，可能该直播间当前无可用流',
      };
    }

    const streams = roomInfo.playurl_info.playurl.stream;
    // 优先取 HLS（m3u8）；若不存在再退回任意协议（下面仍按 host+base_url+extra 拼装）
    const hlsStream =
      streams.find((s) => s.protocol_name === 'http_hls') ??
      streams.find((s) => s.format.some((f) => f.format_name === 'ts'));

    if (!hlsStream) {
      return {
        success: false,
        status: 502,
        error: '未找到 HLS 直播流，该直播间可能不支持 m3u8 协议',
      };
    }

    for (const fmt of hlsStream.format) {
      for (const codec of fmt.codec) {
        const urlInfo = codec.url_info?.[0];
        if (urlInfo?.host) {
          const m3u8Url = urlInfo.host + codec.base_url + urlInfo.extra;
          return {
            success: true,
            data: {
              type: 'live',
              roomId: Number(roomId),
              m3u8Url,
              formatName: fmt.format_name,
              codecName: codec.codec_name,
            },
          };
        }
      }
    }

    return { success: false, status: 502, error: '未找到可用的直播流地址' };
  } catch (error) {
    logger.error('B 站直播解析失败', error);
    return { success: false, status: 500, error: '服务器内部错误，请稍后重试' };
  }
}

/* ==================== 音频中转下载 ==================== */

/**
 * 把 DASH 音轨中转给浏览器。
 *
 * 为什么不能直连：B 站 DASH 音轨（*.bilivideo.com / *.mcdn.bilivideo.cn）会校验
 * `Referer`，必须带 `https://www.bilibili.com` 才返回 200；浏览器里 `<a download>`
 * 发出的是本站地址，实测会被 403 拒绝（视频的 durl 直链不校验，所以只有音频需要
 * 这一步）。顺带解决「跨域时 download 属性被忽略」的问题，并能给出中文文件名。
 */
async function proxyAudioDownload(
  target: AudioParseResult,
  title: string,
  bvid: string,
  page: number
): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetch(target.url, {
      headers: { 'User-Agent': UA, Referer: 'https://www.bilibili.com' },
    });
  } catch (error) {
    logger.error('音频流请求失败', error);
    return NextResponse.json(
      { success: false, error: '获取音频流失败，请稍后重试' },
      { status: 502 }
    );
  }

  if (!upstream.ok || !upstream.body) {
    logger.warn('音频流返回非 2xx', { status: upstream.status });
    return NextResponse.json(
      { success: false, error: `音频流请求被拒绝（${upstream.status}）` },
      { status: 502 }
    );
  }

  const isFlac =
    target.mimeType.toLowerCase().includes('flac') ||
    target.codecs.toLowerCase().includes('flac');
  const ext = isFlac ? 'flac' : 'm4a';

  // 去掉文件名非法字符，避免 Content-Disposition 被截断
  const cleanTitle =
    title
      .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
      .trim()
      .slice(0, 80) || 'audio';
  const asciiName = `${bvid}-p${page}.${ext}`;

  const headers = new Headers({
    'Content-Type': target.mimeType || 'application/octet-stream',
    // filename 给不认识 filename* 的老客户端兜底，filename* 才是中文名
    'Content-Disposition':
      `attachment; filename="${asciiName}"; ` +
      `filename*=UTF-8''${encodeURIComponent(`${cleanTitle}.${ext}`)}`,
    'Cache-Control': 'no-store',
  });

  const contentLength = upstream.headers.get('content-length');
  if (contentLength) headers.set('Content-Length', contentLength);

  return new Response(upstream.body, { status: 200, headers });
}

/* ==================== 路由入口 ==================== */

/**
 * GET /next-api/bilibili-parse
 *
 * 请求：
 *   ?url=string        B 站视频链接 / BV 号 / 直播间链接
 *   &p=number          可选，视频目标分P序号（从 1 开始），优先级高于 url 中的 p
 *   &json=1            可选，返回 JSON 而不是 302 重定向
 *   &download=audio    可选，直接把最高质量音轨以附件形式返回（服务端中转）
 *
 * 行为：
 *   - download=audio → 解析后把音轨中转为附件下载（见 proxyAudioDownload）
 *   - 若 url 匹配 live.bilibili.com → 走直播解析，返回 m3u8 地址
 *   - 否则 → 走视频解析（支持分P），返回 mp4 直链；
 *     并额外用 DASH 接口（fnval=16）解析出最高质量的独立音轨 `audio`
 *     （解析失败时为 null，不影响视频结果）
 *
 * 成功：
 *   - 默认：302 重定向到目标流地址
 *   - json=1：200 { success: true, data: VideoParseResult | LiveParseResult }
 *
 * 失败：400（入参/链接/分P非法/未开播）、502（B 站接口异常）、500（服务端异常）
 *      { success: false, error: string }
 *
 * ⚠️ 直播场景强烈建议使用 `json=1` 获取 m3u8 地址后由播放器自行请求，
 *    因为 B 站 CDN 校验 Referer，浏览器直接 302 跟随请求会因缺少 Referer 被 403。
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { success: false, error: '缺少 url 参数' },
      { status: 400 }
    );
  }

  const asJson = searchParams.get('json') === '1';

  // 分支零：音频中转下载（优先级最高，否则会被下面的 302 分支吃掉）
  if (searchParams.get('download') === 'audio') {
    if (isLiveUrl(url)) {
      return NextResponse.json(
        { success: false, error: '直播流不支持音频下载' },
        { status: 400 }
      );
    }

    const outcome = await parseBilibiliVideo(url, searchParams.get('p'));
    if (!outcome.success) {
      return NextResponse.json(
        { success: false, error: outcome.error },
        { status: outcome.status }
      );
    }
    if (!outcome.data.audio) {
      return NextResponse.json(
        { success: false, error: '该视频未解析到独立音轨' },
        { status: 404 }
      );
    }

    const bvid = url.match(/(BV[a-zA-Z0-9]{10})/)?.[1] ?? 'bilibili';
    return proxyAudioDownload(
      outcome.data.audio,
      outcome.data.title,
      bvid,
      outcome.data.page
    );
  }

  // 分支一：直播
  if (isLiveUrl(url)) {
    const outcome = await parseBilibiliLive(url);
    if (!outcome.success) {
      return NextResponse.json(
        { success: false, error: outcome.error },
        { status: outcome.status }
      );
    }
    if (asJson) {
      return NextResponse.json({ success: true, data: outcome.data });
    }
    return NextResponse.redirect(outcome.data.m3u8Url, 302);
  }

  // 分支二：视频（含分P）
  const pParam = searchParams.get('p');
  const outcome = await parseBilibiliVideo(url, pParam);
  if (!outcome.success) {
    return NextResponse.json(
      { success: false, error: outcome.error },
      { status: outcome.status }
    );
  }
  if (asJson) {
    return NextResponse.json({ success: true, data: outcome.data });
  }
  return NextResponse.redirect(outcome.data.mp4Url, 302);
}
