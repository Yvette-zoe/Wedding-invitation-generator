import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { analyzeInvitation } from '../api/vision';
import { compressImage, friendlyStorageError } from '../utils/image';
import { useInvitation } from '../context/InvitationContext';
import type { Template, TemplateLayout } from '../types';

function fileSizeHint(file: File | null) {
  if (!file) return '';
  const mb = file.size / 1024 / 1024;
  return `${file.name} · ${mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(mb * 1024))} KB`}`;
}

export function TemplateAdmin() {
  const { templates, refreshTemplates, setTemplateId, setView, setStep } = useInvitation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [samplePreview, setSamplePreview] = useState('');
  const [backgroundPreview, setBackgroundPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [analyzingId, setAnalyzingId] = useState('');
  const [layoutResult, setLayoutResult] = useState<Record<string, TemplateLayout>>({});

  const customs = templates.filter((item) => !item.builtin);

  useEffect(() => {
    return () => {
      if (samplePreview) URL.revokeObjectURL(samplePreview);
      if (backgroundPreview) URL.revokeObjectURL(backgroundPreview);
    };
  }, [samplePreview, backgroundPreview]);

  const parseFile = async (source: File): Promise<{ layout: TemplateLayout; usedModel: boolean }> => {
    const dataUrl = await compressImage(source, { maxEdge: 1024, quality: 0.8, maxBytes: 800_000 });
    return analyzeInvitation(dataUrl);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!sampleFile) {
      setMessage('请先上传含文案的成品请柬，用于解析位置');
      return;
    }
    if (!backgroundFile) {
      setMessage('请再上传无文案的空白底图，用于合成新请柬');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const parsed = await parseFile(sampleFile);
      const created = await api.uploadTemplateWithLayout({
        sampleFile,
        backgroundFile,
        name,
        description,
        tags: ['自定义'],
        layout: parsed.layout,
      });
      await refreshTemplates();
      setTemplateId(created.id);
      setName('');
      setDescription('');
      setSampleFile(null);
      setBackgroundFile(null);
      if (samplePreview) URL.revokeObjectURL(samplePreview);
      if (backgroundPreview) URL.revokeObjectURL(backgroundPreview);
      setSamplePreview('');
      setBackgroundPreview('');
      setMessage(
        parsed.usedModel
          ? '已用成品请柬解析排版，空白底图已加入模板库'
          : '未配置视觉模型 API key，已按常见版式自动估算',
      );
    } catch (err) {
      setMessage(friendlyStorageError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await api.deleteTemplate(id);
      await refreshTemplates();
    } catch (err) {
      setMessage(friendlyStorageError(err));
    } finally {
      setBusy(false);
    }
  };

  const analyzeExisting = async (tpl: Template) => {
    const src = tpl.sampleUrl || tpl.coverUrl || tpl.backgroundUrl;
    if (!src) return;
    setAnalyzingId(tpl.id);
    setMessage('');
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = src;
      await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error('成品请柬读取失败'));
      });
      const blob = await fetch(img.src).then((res) => res.blob());
      const file = new File([blob], `${tpl.name}.jpg`, { type: 'image/jpeg' });
      const parsed = await parseFile(file);
      const updated = await api.updateTemplateLayout(tpl.id, parsed.layout);
      await refreshTemplates();
      setLayoutResult((prev) => ({ ...prev, [tpl.id]: updated.layout ?? parsed.layout }));
      setMessage(
        parsed.usedModel
          ? `「${updated.name}」解析完成，已写入 ${parsed.layout.regions.length} 个文案位置`
          : `「${updated.name}」已按常见版式估算 ${parsed.layout.regions.length} 个位置`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '解析失败');
    } finally {
      setAnalyzingId('');
    }
  };

  return (
    <section className="page page--admin">
      <header className="page__head">
        <h2>维护模板库</h2>
        <p>
          每个模板上传两张图：成品请柬用来解析新人照片和文案位置；空白底图用来合成新请柬。没接 API
          key 时会自动估算位置。
        </p>
      </header>

      <form className="admin-form" onSubmit={(e) => void onSubmit(e)}>
        <p className="file-pick-head">成品请柬（含文案和宾客名）</p>
        <label className={`file-pick${samplePreview ? ' has-preview' : ''}`}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              setSampleFile(next);
              if (samplePreview) URL.revokeObjectURL(samplePreview);
              setSamplePreview(next ? URL.createObjectURL(next) : '');
            }}
          />
          {samplePreview ? <img src={samplePreview} alt="成品请柬预览" /> : null}
          <span>{sampleFile ? fileSizeHint(sampleFile) : '上传成品请柬 JPG / PNG'}</span>
        </label>
        <p className="file-pick-head">空白底图（无文案、无宾客名）</p>
        <label className={`file-pick${backgroundPreview ? ' has-preview' : ''}`}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              setBackgroundFile(next);
              if (backgroundPreview) URL.revokeObjectURL(backgroundPreview);
              setBackgroundPreview(next ? URL.createObjectURL(next) : '');
            }}
          />
          {backgroundPreview ? <img src={backgroundPreview} alt="空白底图预览" /> : null}
          <span>{backgroundFile ? fileSizeHint(backgroundFile) : '上传空白底图 JPG / PNG'}</span>
        </label>
        <label className="block">
          模板名称
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：传统请帖" />
        </label>
        <label className="block">
          简介
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="选填"
          />
        </label>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? '正在解析并保存…' : '视觉解析并上传'}
        </button>
      </form>

      {message ? (
        <p
          className={
            message.includes('失败') || message.includes('存不下') || message.includes('接口')
              ? 'error'
              : 'hint'
          }
        >
          {message}
        </p>
      ) : null}

      <h3 className="subhead">自定义模板 {customs.length}</h3>
      {customs.length === 0 ? <p className="hint">还没有上传模板</p> : null}
      <ul className="admin-list">
        {customs.map((item) => {
          const layout = layoutResult[item.id] ?? item.layout;
          return (
            <li key={item.id} className="admin-list__item">
              <div className="admin-list__thumbs">
                <img src={item.sampleUrl || item.coverUrl} alt="成品" />
                <img src={item.backgroundUrl} alt="底图" />
              </div>
              <div className="admin-list__body">
                <strong>{item.name}</strong>
                <p>{item.description}</p>
                {layout ? (
                  <p className="admin-list__layout">
                    已解析 {layout.regions.length} 个位置：{layout.regions.map((r) => r.label).join('、')}
                  </p>
                ) : null}
              </div>
              <div className="admin-list__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={analyzingId === item.id}
                  onClick={() => void analyzeExisting(item)}
                >
                  {analyzingId === item.id ? '解析中…' : item.layout ? '重新解析' : '解析排版'}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => void remove(item.id)}>
                  删除
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="btn btn--primary"
        onClick={() => {
          setView('wizard');
          setStep(1);
        }}
      >
        返回选择模板
      </button>
    </section>
  );
}
