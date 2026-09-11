import type { Template, TemplateLayout } from '../types';
import { mockApi } from './mock';

/**
 * 后端数据接口层。
 * demo 默认走 mock；将 VITE_USE_MOCK 设为 false 后，以下路径对接真实服务。
 *
 * GET    /api/templates
 * GET    /api/templates/:id
 * POST   /api/templates                 FormData: file, name, description, tags
 * POST   /api/templates/parse           FormData: sampleFile, backgroundFile, name, description, tags → 视觉解析后排版
 * POST   /api/templates/:id/layout      JSON: TemplateLayout（手动更新锚点）
 * DELETE /api/templates/:id
 * POST   /api/invitations               保存请柬项目（文案 + 宾客）
 * POST   /api/invitations/:id/export    服务端批量导出 JPG（后续）
 */
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    throw new Error(`接口失败 ${res.status}: ${path}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  async listTemplates(): Promise<Template[]> {
    if (USE_MOCK) return mockApi.listTemplates();
    return request<Template[]>('/templates');
  },

  async getTemplate(id: string): Promise<Template> {
    if (USE_MOCK) return mockApi.getTemplate(id);
    return request<Template>(`/templates/${id}`);
  },

  async uploadTemplate(payload: {
    file: File;
    name: string;
    description: string;
    tags: string[];
  }): Promise<Template> {
    if (USE_MOCK) return mockApi.uploadTemplate(payload);
    const body = new FormData();
    body.append('file', payload.file);
    body.append('name', payload.name);
    body.append('description', payload.description);
    body.append('tags', JSON.stringify(payload.tags));
    return request<Template>('/templates', { method: 'POST', body });
  },

  /** 成品请柬视觉解析，空白底图入库用于合成 */
  async uploadTemplateWithLayout(payload: {
    file?: File;
    sampleFile?: File;
    backgroundFile?: File;
    name: string;
    description: string;
    tags: string[];
    layout: TemplateLayout;
  }): Promise<Template> {
    if (USE_MOCK) return mockApi.uploadTemplateWithLayout(payload);
    const body = new FormData();
    const sample = payload.sampleFile ?? payload.file;
    const background = payload.backgroundFile ?? payload.file;
    if (sample) body.append('sampleFile', sample);
    if (background) body.append('backgroundFile', background);
    body.append('name', payload.name);
    body.append('description', payload.description);
    body.append('tags', JSON.stringify(payload.tags));
    body.append('layout', JSON.stringify(payload.layout));
    return request<Template>('/templates/parse', { method: 'POST', body });
  },

  async updateTemplateLayout(id: string, layout: TemplateLayout): Promise<Template> {
    if (USE_MOCK) return mockApi.updateTemplateLayout(id, layout);
    return request<Template>(`/templates/${id}/layout`, {
      method: 'POST',
      body: JSON.stringify(layout),
    });
  },

  async deleteTemplate(id: string): Promise<void> {
    if (USE_MOCK) return mockApi.deleteTemplate(id);
    await request<void>(`/templates/${id}`, { method: 'DELETE' });
  },

  /** 预留下一阶段：把请柬项目存到后端 */
  async saveInvitation(payload: unknown): Promise<{ id: string }> {
    if (USE_MOCK) {
      return { id: 'inv_local_draft' };
    }
    return request<{ id: string }>('/invitations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
