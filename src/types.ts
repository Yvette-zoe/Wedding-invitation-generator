/** 请柬模板风格 */
export type TemplateStyle =
  | 'crimson-gold'
  | 'champagne'
  | 'ink-gold'
  | 'garden'
  | 'blush-rose'
  | 'custom-image';

/** 模板可落位的文案槽 */
export type LayoutSlot =
  | 'couple'
  | 'date'
  | 'time'
  | 'venue'
  | 'guest'
  | 'host'
  | 'closing'
  | 'photo';

export interface LayoutRegion {
  slot: LayoutSlot;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  fontWeight: number;
  align: 'left' | 'center' | 'right';
  color?: string;
  label: string;
  sample: string;
  /** 竖排栏位（传统请柬常见） */
  vertical?: boolean;
}

export interface TemplateLayout {
  width: number;
  height: number;
  regions: LayoutRegion[];
  summary: string;
}

/** 模板库条目，后续可由后台上传维护 */
export interface Template {
  id: string;
  name: string;
  description: string;
  style: TemplateStyle;
  tags: string[];
  /** 模板选择页封面，自定义模板用成品请柬 */
  coverUrl?: string;
  /** 成品请柬（含文案/宾客），供视觉模型解析位置 */
  sampleUrl?: string;
  /** 无文案底图，用于合成新请柬 */
  backgroundUrl?: string;
  layout?: TemplateLayout;
  createdAt: string;
  updatedAt: string;
  builtin: boolean;
}

/** 判断模板是否按解析排版渲染 */
export function hasParsedLayout(template: Template): boolean {
  return Boolean(
    template.style === 'custom-image' &&
      template.backgroundUrl &&
      template.layout &&
      template.layout.regions.length > 0,
  );
}

/** 请柬统一文案 */
export interface InvitationContent {
  groomName: string;
  brideName: string;
  coupleOrder: 'groom-first' | 'bride-first';
  eventTitle: string;
  greetingPrefix: string;
  bodyText: string;
  solarDate: string;
  lunarDate: string;
  time: string;
  venue: string;
  address: string;
  closing: string;
  hostNames: string;
  /** 新人婚纱照，data URL */
  photoUrl: string;
}

/** 宾客 */
export interface Guest {
  id: string;
  name: string;
  honorific: string;
}

export const HONORIFICS = ['先生', '女士', '小姐', '老师', '伉俪', '一家', ''] as const;

export const DEFAULT_CONTENT: InvitationContent = {
  groomName: '顾承安',
  brideName: '沈清欢',
  coupleOrder: 'groom-first',
  eventTitle: '婚礼典礼',
  greetingPrefix: '尊敬的',
  bodyText: '谨定于良辰吉日举行婚礼典礼\n恭请亲友莅临见证，分享我们的喜悦',
  solarDate: '2026年10月18日',
  lunarDate: '农历九月初八',
  time: '中午十二时正',
  venue: '苏州 · 金鸡湖凯宾斯基酒店',
  address: '金鸡湖大道88号 · 金桂厅',
  closing: '恭请光临',
  hostNames: '双方家长 敬邀',
  photoUrl: '',
};

export function displayCouple(content: InvitationContent): [string, string] {
  return content.coupleOrder === 'groom-first'
    ? [content.groomName, content.brideName]
    : [content.brideName, content.groomName];
}

export function displayCoupleLine(content: InvitationContent): string {
  const [left, right] = displayCouple(content);
  return `${left || '新郎'} & ${right || '新娘'}`;
}

export function displayGuestLine(content: InvitationContent, guest: Guest): string {
  const name = guest.name.trim().replace(/\s+/g, ' ') || '宾客';
  const prefix = content.greetingPrefix.trim() || '尊敬的';
  const honor = guest.honorific.trim();
  return [prefix, name, honor].filter(Boolean).join(' ');
}

export function displayDateLine(content: InvitationContent): string {
  return [content.solarDate, content.lunarDate].filter(Boolean).join(' ');
}

export function displayVenueLine(content: InvitationContent): string {
  return [content.venue, content.address].filter(Boolean).join(' ');
}
