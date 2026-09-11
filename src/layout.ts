import type { LayoutRegion, LayoutSlot, TemplateLayout } from './types';

const SLOTS: LayoutSlot[] = ['couple', 'date', 'time', 'venue', 'guest', 'host', 'closing', 'photo'];
const ALIGNS: LayoutRegion['align'][] = ['left', 'center', 'right'];

const LABELS: Record<LayoutSlot, string> = {
  couple: '新人姓名',
  date: '日期',
  time: '时间',
  venue: '地点',
  guest: '宾客称谓',
  host: '落款',
  closing: '敬语',
  photo: '婚纱照',
};

export function normalizeSlot(value: unknown): LayoutSlot | null {
  const v = String(value ?? '').toLowerCase();
  const map: Record<string, LayoutSlot> = {
    couple: 'couple',
    couple_name: 'couple',
    names: 'couple',
    name: 'couple',
    date: 'date',
    time: 'time',
    venue: 'venue',
    location: 'venue',
    address: 'venue',
    guest: 'guest',
    greeting: 'guest',
    salutation: 'guest',
    recipient: 'guest',
    host: 'host',
    signature: 'host',
    hosts: 'host',
    closing: 'closing',
    photo: 'photo',
    image: 'photo',
    picture: 'photo',
  };
  if (map[v]) return map[v];
  const direct = SLOTS.find((slot) => slot === v);
  return direct ?? null;
}

export function normalizeLayout(raw: unknown, imageW: number, imageH: number): TemplateLayout {
  const obj = raw as Record<string, unknown>;
  const rawRegions = (obj?.regions ?? obj?.slots ?? obj?.elements) as Array<Record<string, unknown>>;
  const regions: LayoutRegion[] = [];

  for (const item of rawRegions ?? []) {
    const slot = normalizeSlot(item.slot ?? item.type ?? item.id);
    if (!slot || regions.some((r) => r.slot === slot)) continue;

    const box = coerceBox(item, imageW, imageH);
    if (!box) continue;

    const align = ALIGNS.includes(item.align as LayoutRegion['align'])
      ? (item.align as LayoutRegion['align'])
      : 'center';
    const vertical =
      item.vertical === true ||
      item.writingMode === 'vertical' ||
      item.writingMode === 'vertical-rl' ||
      box.h > box.w * 1.25;

    regions.push({
      slot,
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      fontSize: Number(item.fontSize) > 0 ? Number(item.fontSize) : 16,
      fontWeight: Number(item.fontWeight) >= 100 ? Number(item.fontWeight) : 400,
      align,
      color: typeof item.color === 'string' ? item.color : undefined,
      label: typeof item.label === 'string' && item.label.trim() ? item.label : LABELS[slot],
      sample: typeof item.sample === 'string' ? item.sample : '',
      vertical,
    });
  }

  return {
    width: imageW,
    height: imageH,
    regions,
    summary: typeof obj?.summary === 'string' ? obj.summary : '',
  };
}

/** 兼容像素 / 0-1 归一化 / 百分数三种坐标 */
function coerceBox(
  item: Record<string, unknown>,
  imageW: number,
  imageH: number,
): { x: number; y: number; w: number; h: number } | null {
  let x = Number(item.x);
  let y = Number(item.y);
  let w = Number(item.w);
  let h = Number(item.h);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
  if (w <= 0 || h <= 0) return null;

  if (x >= 0 && y >= 0 && x <= 1 && y <= 1 && w <= 1 && h <= 1) {
    x *= imageW;
    y *= imageH;
    w *= imageW;
    h *= imageH;
  }

  if (x < 0 || y < 0 || x + w > imageW * 1.25 || y + h > imageH * 1.25) return null;
  return { x, y, w, h };
}

/** 把解析坐标从成品图尺寸缩放到合成底图尺寸 */
export function scaleLayout(layout: TemplateLayout, width: number, height: number): TemplateLayout {
  if (!layout.width || !layout.height || width <= 0 || height <= 0) {
    return { ...layout, width, height };
  }
  const scaleX = width / layout.width;
  const scaleY = height / layout.height;
  if (Math.abs(scaleX - 1) < 0.01 && Math.abs(scaleY - 1) < 0.01) {
    return { ...layout, width, height };
  }
  return {
    ...layout,
    width,
    height,
    regions: layout.regions.map((r) => ({
      ...r,
      x: Math.round(r.x * scaleX),
      y: Math.round(r.y * scaleY),
      w: Math.round(r.w * scaleX),
      h: Math.round(r.h * scaleY),
      fontSize: Math.max(1, Math.round(r.fontSize * scaleY)),
    })),
  };
}

function photoBox(x: number, y: number, w: number, h: number): LayoutRegion {
  return {
    slot: 'photo',
    x,
    y,
    w,
    h,
    fontSize: 16,
    fontWeight: 400,
    align: 'center',
    label: '婚纱照',
    sample: '',
    vertical: false,
  };
}

/** 只要框足够大就采信，横版请柬照片经常在左页或右页 */
export function isPlausiblePhotoSlot(region: LayoutRegion, layout: TemplateLayout): boolean {
  const area = (region.w * region.h) / (layout.width * layout.height);
  if (area < 0.06 || area > 0.8) return false;
  if (region.w < layout.width * 0.12 || region.h < layout.height * 0.16) return false;
  return true;
}

/** 缺 photo 槽时的兜底：横版对开偏右页，竖版居中偏上 */
export function inferPhotoRegion(layout: TemplateLayout): LayoutRegion {
  const w = layout.width;
  const h = layout.height;
  if (w > h * 1.15) {
    return photoBox(w * 0.5, h * 0.1, w * 0.46, h * 0.82);
  }

  const guest = layout.regions.find((r) => r.slot === 'guest');
  const couple = layout.regions.find((r) => r.slot === 'couple');

  if (guest && guest.y < h * 0.7) {
    const belowTitle =
      couple && couple.y + couple.h < guest.y ? couple.y + couple.h + h * 0.012 : h * 0.1;
    const top = Math.min(belowTitle, Math.max(h * 0.08, guest.y - h * 0.42));
    const bottom = Math.min(h * 0.68, guest.y + guest.h * 0.85);
    const height = Math.max(h * 0.28, bottom - top);
    const width = Math.min(w * 0.58, height * 0.78);
    return photoBox((w - width) / 2, top, width, height);
  }

  return photoBox(w * 0.22, h * 0.1, w * 0.56, h * 0.4);
}

export function applyPhotoBox(
  layout: TemplateLayout,
  box: { x: number; y: number; w: number; h: number },
): TemplateLayout {
  return {
    ...layout,
    regions: [photoBox(box.x, box.y, box.w, box.h), ...layout.regions.filter((r) => r.slot !== 'photo')],
  };
}

/** 用户已上传婚纱照时，保证 layout 里有一块中上部的照片区 */
export function withPhotoRegion(layout: TemplateLayout): TemplateLayout {
  const existing = layout.regions.find((r) => r.slot === 'photo');
  if (existing && isPlausiblePhotoSlot(existing, layout)) return layout;
  return applyPhotoBox(layout, inferPhotoRegion(layout));
}

export function fallbackLayout(imageW: number, imageH: number): TemplateLayout {
  const w = imageW;
  const h = imageH;
  return {
    width: w,
    height: h,
    summary: '按常见请柬排版自动估算',
    regions: [
      photoBox(w * 0.28, h * 0.08, w * 0.44, h * 0.22),
      { slot: 'couple', x: w * 0.22, y: h * 0.34, w: w * 0.56, h: h * 0.1, fontSize: Math.round(h * 0.045), fontWeight: 700, align: 'center', label: '新人姓名', sample: '新郎 & 新娘', vertical: false },
      { slot: 'date', x: w * 0.3, y: h * 0.47, w: w * 0.4, h: h * 0.05, fontSize: Math.round(h * 0.026), fontWeight: 600, align: 'center', label: '日期', sample: '2026年10月18日', vertical: false },
      { slot: 'time', x: w * 0.3, y: h * 0.53, w: w * 0.4, h: h * 0.05, fontSize: Math.round(h * 0.026), fontWeight: 600, align: 'center', label: '时间', sample: '中午十二时正', vertical: false },
      { slot: 'venue', x: w * 0.18, y: h * 0.6, w: w * 0.64, h: h * 0.08, fontSize: Math.round(h * 0.022), fontWeight: 500, align: 'center', label: '地点', sample: '宴会地点', vertical: false },
      { slot: 'guest', x: w * 0.18, y: h * 0.86, w: w * 0.64, h: h * 0.05, fontSize: Math.round(h * 0.02), fontWeight: 500, align: 'center', label: '宾客称谓', sample: '尊敬的 宾客', vertical: false },
      { slot: 'host', x: w * 0.18, y: h * 0.93, w: w * 0.64, h: h * 0.04, fontSize: Math.round(h * 0.016), fontWeight: 400, align: 'center', label: '落款', sample: '双方家长 敬邀', vertical: false },
    ],
  };
}
