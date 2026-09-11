import type { TemplateLayout } from '../types';
import { compressImage } from '../utils/image';
import { normalizeLayout, fallbackLayout } from '../layout';

const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

function visionConfig() {
  const key = import.meta.env.VITE_VL_API_KEY || import.meta.env.VITE_DEEPSEEK_API_KEY || '';
  let url =
    import.meta.env.VITE_VL_API_URL ||
    import.meta.env.VITE_DEEPSEEK_API_URL ||
    DASHSCOPE_URL;
  let model =
    import.meta.env.VITE_VL_MODEL ||
    import.meta.env.VITE_DEEPSEEK_MODEL ||
    'qwen3-vl-plus';

  // DeepSeek 官方接口没有 Qwen；模型名是 qwen 时改走阿里云兼容端点
  if (/qwen/i.test(model) && /api\.deepseek\.com/i.test(url)) {
    url = DASHSCOPE_URL;
  }
  if (/^qwen3-vl$/i.test(model.trim())) {
    model = /siliconflow/i.test(url) ? 'Qwen/Qwen3-VL-32B-Instruct' : 'qwen3-vl-plus';
  }
  // 必须在改写成本地代理路径之前判断，否则开发态下永远匹配不到 dashscope 域名
  const isDashscope = /dashscope|aliyuncs/i.test(url);
  return { key, url: requestUrl(url), model, isDashscope };
}

/** 开发态走 Vite 代理，避免浏览器跨域拦截视觉接口 */
function requestUrl(url: string) {
  if (!import.meta.env.DEV) return url;
  try {
    const parsed = new URL(url);
    return `/vl-proxy${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

const PROMPT = `你是婚礼请柬排版分析器。请分析图片中的成品婚礼请柬，输出 JSON，且只输出 JSON，不要包含 markdown 代码块。

坐标必须使用本图真实像素，左上角为 (0,0)。width、height 必须等于本图像素宽高，所有 x/y/w/h 必须落在该宽高内。

找出以下可替换要素的位置、尺寸、字号、粗细、对齐：
- couple：新人姓名
- date：日期
- time：时间
- venue：地点
- guest：宾客称谓（如“尊敬的 xxx”）
- host：落款（如“双方家长 敬邀”）
- closing：敬语
- photo：婚纱照。图上只要有人物照片、婚纱照或相框，就必须返回 photo，且框住整张照片（不要只标文字）。对开请柬的照片常常在左页或右页，不要标到中间空白处。

若某段文字是竖排（从上到下、从右到左），该框必须是瘦高矩形，并设置 "vertical": true。

JSON 格式：
{"width": 0, "height": 0, "summary": "一句话版式概述", "regions": [{"slot": "couple", "x": 0, "y": 0, "w": 0, "h": 0, "fontSize": 0, "fontWeight": 400, "align": "center", "vertical": false, "color": "#000000", "label": "新人姓名", "sample": "图上实际文字"}]}

仅返回 JSON，键名必须用双引号，例如 "slot" 不能写成 slot。`;

function tryParseJson(text: string): unknown {
  return JSON.parse(text);
}

/** 模型常返回无引号键名、尾逗号、单引号，这里尽量修成可解析 JSON */
function repairJson(text: string): string {
  let src = text.trim();
  src = src.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  src = src.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  src = src.replace(/\/\/[^\n]*/g, '');
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  src = src.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false').replace(/\bNone\b/g, 'null');
  src = src.replace(/,\s*([}\]])/g, '$1');
  src = src.replace(/([{,]\s*)([A-Za-z_][\w]*)\s*:/g, '$1"$2":');
  src = convertSingleQuotedStrings(src);
  return src;
}

/** 把不在双引号字符串内的单引号字符串改成双引号 */
function convertSingleQuotedStrings(src: string): string {
  let out = '';
  let inDouble = false;
  let escape = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (escape) {
      out += ch;
      escape = false;
      continue;
    }
    if (ch === '\\' && inDouble) {
      out += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      inDouble = !inDouble;
      out += ch;
      continue;
    }
    if (!inDouble && ch === "'") {
      let j = i + 1;
      let buf = '';
      while (j < src.length && src[j] !== "'") {
        buf += src[j] === '"' ? '\\"' : src[j];
        j += 1;
      }
      out += `"${buf}"`;
      i = j;
      continue;
    }
    out += ch;
  }
  return out;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1]?.trim(), trimmed].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) continue;
    const slice = candidate.slice(start, end + 1);
    try {
      return tryParseJson(slice);
    } catch {
      try {
        return tryParseJson(repairJson(slice));
      } catch {
        /* 试下一段候选 */
      }
    }
  }
  throw new Error('视觉模型返回的排版数据无法解析，请再点一次「视觉解析并上传」');
}

/** 先把模型坐标系映射到成品图像素，再做合法性校验，避免大坐标被直接丢掉 */
function remapToImageSize(raw: Record<string, unknown>, imageW: number, imageH: number): Record<string, unknown> {
  const modelW = Number(raw.width);
  const modelH = Number(raw.height);
  const srcW = modelW > 1 ? modelW : imageW;
  const srcH = modelH > 1 ? modelH : imageH;
  const regions = (raw.regions ?? raw.slots ?? raw.elements) as Array<Record<string, unknown>> | undefined;
  if (!regions?.length) return { ...raw, width: imageW, height: imageH };

  const sx = imageW / srcW;
  const sy = imageH / srcH;
  return {
    ...raw,
    width: imageW,
    height: imageH,
    regions: regions.map((item) => {
      let x = Number(item.x);
      let y = Number(item.y);
      let w = Number(item.w);
      let h = Number(item.h);
      if (x >= 0 && y >= 0 && x <= 1 && y <= 1 && w <= 1 && h <= 1 && w > 0 && h > 0) {
        x *= srcW;
        y *= srcH;
        w *= srcW;
        h *= srcH;
      }
      const fontSize = Number(item.fontSize);
      return {
        ...item,
        x: x * sx,
        y: y * sy,
        w: w * sx,
        h: h * sy,
        fontSize: fontSize > 0 ? fontSize * sy : item.fontSize,
      };
    }),
  };
}

async function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('图片读取失败'));
    img.src = dataUrl;
  });
}

export interface VisionAnalysis {
  layout: TemplateLayout;
  usedModel: boolean;
}

/** @deprecated 使用 VisionAnalysis */
export type DeepSeekAnalysis = VisionAnalysis;

function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) return String((part as { text?: string }).text ?? '');
        return '';
      })
      .join('');
  }
  return String(content ?? '');
}

async function postVision(url: string, key: string, payload: Record<string, unknown>): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function analyzeInvitation(imageDataUrl: string): Promise<VisionAnalysis> {
  const size = await imageSize(imageDataUrl);
  const { key, url, model, isDashscope } = visionConfig();
  if (!key) {
    return { layout: fallbackLayout(size.width, size.height), usedModel: false };
  }

  const payload: Record<string, unknown> = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  };
  if (isDashscope) {
    payload.enable_thinking = false;
    payload.response_format = { type: 'json_object' };
  }

  let res = await postVision(url, key, payload);
  if (!res.ok && payload.response_format) {
    const text = await res.text();
    if (res.status === 400 && /response_format|json_object/i.test(text)) {
      delete payload.response_format;
      res = await postVision(url, key, payload);
    } else {
      throw new Error(`视觉接口失败 ${res.status}：${text.slice(0, 160)}`);
    }
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`视觉接口失败 ${res.status}：${text.slice(0, 160)}`);
  }
  const data = await res.json();
  const message = data?.choices?.[0]?.message;
  const rawText = [messageText(message?.content), messageText(message?.reasoning_content)]
    .filter((part) => part && part !== 'undefined' && part !== 'null')
    .join('\n');
  const raw = extractJson(rawText) as Record<string, unknown>;
  const prepared = remapToImageSize(raw, size.width, size.height);
  const layout = normalizeLayout(prepared, size.width, size.height);
  if (!layout.regions.length) {
    return { layout: fallbackLayout(size.width, size.height), usedModel: true };
  }
  return { layout, usedModel: true };
}

/** 上传模板时用的分析入口：先把大图压成模型可接受的尺寸 */
export async function analyzeInvitationFile(file: File): Promise<VisionAnalysis> {
  const dataUrl = await compressImage(file, { maxEdge: 1024, quality: 0.8, maxBytes: 800_000 });
  return analyzeInvitation(dataUrl);
}
