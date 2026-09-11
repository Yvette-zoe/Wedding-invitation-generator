import type { Template, TemplateLayout } from '../types';
import { createId } from '../utils/id';
import { compressImage, readImageSize } from '../utils/image';
import { scaleLayout } from '../layout';
import { idbGet, idbSet } from '../utils/idb';

const LEGACY_KEY = 'wedding-custom-templates';
const IDB_KEY = 'custom-templates';

const wait = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

const BUILTIN: Template[] = [
  {
    id: 'tpl_crimson',
    name: '朱金中式',
    description: '朱红底金纹，适合中式典礼与晚宴',
    style: 'crimson-gold',
    tags: ['中式', '喜庆', '经典'],
    builtin: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tpl_champagne',
    name: '香槟法式',
    description: '奶油纸感与细金边，偏西式典礼',
    style: 'champagne',
    tags: ['西式', '优雅', '纸感'],
    builtin: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tpl_inkgold',
    name: '墨金夜宴',
    description: '墨色铺底、烫金细线，适合晚宴场',
    style: 'ink-gold',
    tags: ['轻奢', '晚宴', '极简'],
    builtin: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tpl_garden',
    name: '森系花园',
    description: '嫩芽绿与手绘枝叶，户外或花园婚礼',
    style: 'garden',
    tags: ['户外', '清新', '花园'],
    builtin: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tpl_blush',
    name: '雾粉玫瑰',
    description: '豆沙粉与玫瑰金，偏浪漫写真风',
    style: 'blush-rose',
    tags: ['浪漫', '粉色', '写真'],
    builtin: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function readLegacy(): Template[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Template[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readCustom(): Promise<Template[]> {
  const stored = await idbGet<Template[]>(IDB_KEY);
  if (stored?.length) return stored;
  const legacy = readLegacy();
  if (legacy.length) {
    await idbSet(IDB_KEY, legacy);
    localStorage.removeItem(LEGACY_KEY);
  }
  return legacy;
}

async function writeCustom(list: Template[]) {
  await idbSet(IDB_KEY, list);
  localStorage.removeItem(LEGACY_KEY);
}

async function nextCustom(): Promise<Template[]> {
  return readCustom();
}

async function replaceCustom(id: string, patch: Partial<Template>): Promise<Template> {
  const current = await readCustom();
  const index = current.findIndex((item) => item.id === id);
  if (index === -1) throw new Error('模板不存在');
  const next = { ...current[index], ...patch, updatedAt: new Date().toISOString() };
  current[index] = next;
  await writeCustom(current);
  return next;
}

async function createTemplate(payload: {
  file?: File;
  sampleFile?: File;
  backgroundFile?: File;
  name: string;
  description: string;
  tags: string[];
  layout?: TemplateLayout;
}): Promise<Template> {
  const sampleSource = payload.sampleFile ?? payload.file;
  const backgroundSource = payload.backgroundFile ?? payload.file;
  if (!sampleSource || !backgroundSource) {
    throw new Error('请同时上传成品请柬和空白底图');
  }

  const [sampleUrl, backgroundUrl] = await Promise.all([
    compressImage(sampleSource, { maxEdge: 1400, quality: 0.82, maxBytes: 800_000 }),
    compressImage(backgroundSource, { maxEdge: 1400, quality: 0.82, maxBytes: 800_000 }),
  ]);
  const bgSize = await readImageSize(backgroundUrl);
  const layout = payload.layout ? scaleLayout(payload.layout, bgSize.width, bgSize.height) : undefined;
  const now = new Date().toISOString();
  const template: Template = {
    id: createId('tpl'),
    name: payload.name.trim() || '自定义模板',
    description: payload.description.trim() || '自定义上传模板',
    style: 'custom-image',
    tags: payload.tags.length ? payload.tags : ['自定义'],
    coverUrl: sampleUrl,
    sampleUrl,
    backgroundUrl,
    layout,
    builtin: false,
    createdAt: now,
    updatedAt: now,
  };
  const current = await nextCustom();
  await writeCustom([template, ...current]);
  return template;
}

export const mockApi = {
  async listTemplates(): Promise<Template[]> {
    await wait();
    const custom = await readCustom();
    return [...custom, ...BUILTIN];
  },

  async getTemplate(id: string): Promise<Template> {
    await wait();
    const custom = await readCustom();
    const found = [...custom, ...BUILTIN].find((item) => item.id === id);
    if (!found) throw new Error('模板不存在');
    return found;
  },

  async uploadTemplate(payload: {
    file: File;
    name: string;
    description: string;
    tags: string[];
  }): Promise<Template> {
    await wait(120);
    return createTemplate(payload);
  },

  async uploadTemplateWithLayout(payload: {
    file?: File;
    sampleFile?: File;
    backgroundFile?: File;
    name: string;
    description: string;
    tags: string[];
    layout: TemplateLayout;
  }): Promise<Template> {
    await wait(120);
    return createTemplate(payload);
  },

  async updateTemplateLayout(id: string, layout: TemplateLayout): Promise<Template> {
    await wait();
    const current = await readCustom();
    const target = current.find((item) => item.id === id);
    if (!target) throw new Error('模板不存在');
    let nextLayout = layout;
    if (target.backgroundUrl) {
      const bgSize = await readImageSize(target.backgroundUrl);
      nextLayout = scaleLayout(layout, bgSize.width, bgSize.height);
    }
    return replaceCustom(id, { layout: nextLayout });
  },

  async deleteTemplate(id: string): Promise<void> {
    await wait();
    const current = await readCustom();
    const target = current.find((item) => item.id === id);
    if (!target) throw new Error('内置模板不可删除');
    await writeCustom(current.filter((item) => item.id !== id));
  },
};
