import { useState, useRef, useEffect, type PointerEvent as ReactPointerEvent } from 'react';
import { api } from '../api/client';
import { analyzeInvitation } from '../api/vision';
import { compressImage, friendlyStorageError, readImageSize } from '../utils/image';
import { useInvitation } from '../context/InvitationContext';
import { downloadDataUrl } from '../utils/exportJpg';
import type { TemplateLayout, LayoutRegion, LayoutSlot } from '../types';
import { scaleLayout } from '../layout';

type WorkbenchStep = 'upload' | 'adjust' | 'ps-checklist' | 'publish';

const REQUIRED_SLOTS: LayoutSlot[] = ['couple', 'date', 'venue'];
const RECOMMENDED_SLOTS: LayoutSlot[] = ['time', 'guest', 'host', 'closing'];

const SLOT_LABELS: Record<LayoutSlot, string> = {
  couple: '新人姓名',
  date: '日期',
  time: '时间',
  venue: '地点',
  guest: '宾客称谓',
  host: '落款',
  closing: '敬语',
  photo: '婚纱照',
};

function getSlotCategory(slot: LayoutSlot): 'required' | 'recommended' | 'optional' {
  if (REQUIRED_SLOTS.includes(slot)) return 'required';
  if (RECOMMENDED_SLOTS.includes(slot)) return 'recommended';
  return 'optional';
}

interface RegionEditorProps {
  layout: TemplateLayout;
  imageUrl: string;
  onLayoutChange: (layout: TemplateLayout) => void;
}

function RegionEditor({ layout, imageUrl, onLayoutChange }: RegionEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [selectedSlot, setSelectedSlot] = useState<LayoutSlot | null>(null);
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    handle?: string;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const containerW = el.clientWidth;
      setScale(containerW / layout.width);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [layout.width]);

  const updateRegion = (slot: LayoutSlot, patch: Partial<LayoutRegion>) => {
    onLayoutChange({
      ...layout,
      regions: layout.regions.map((r) => (r.slot === slot ? { ...r, ...patch } : r)),
    });
  };

  const toggleVertical = (slot: LayoutSlot) => {
    const region = layout.regions.find((r) => r.slot === slot);
    if (region) {
      updateRegion(slot, { vertical: !region.vertical });
    }
  };

  const addSlot = (slot: LayoutSlot) => {
    if (layout.regions.some((r) => r.slot === slot)) return;
    const newRegion: LayoutRegion = {
      slot,
      x: layout.width * 0.25,
      y: layout.height * 0.4,
      w: layout.width * 0.5,
      h: layout.height * 0.08,
      fontSize: Math.round(layout.height * 0.025),
      fontWeight: 400,
      align: 'center',
      label: SLOT_LABELS[slot],
      sample: '',
      vertical: false,
    };
    onLayoutChange({ ...layout, regions: [...layout.regions, newRegion] });
  };

  const removeSlot = (slot: LayoutSlot) => {
    onLayoutChange({ ...layout, regions: layout.regions.filter((r) => r.slot !== slot) });
  };

  const handlePointerDown = (
    e: ReactPointerEvent<HTMLDivElement>,
    slot: LayoutSlot,
    type: 'move' | 'resize',
    handle?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const region = layout.regions.find((r) => r.slot === slot);
    if (!region) return;
    setSelectedSlot(slot);
    setDragState({
      type,
      startX: e.clientX,
      startY: e.clientY,
      origX: region.x,
      origY: region.y,
      origW: region.w,
      origH: region.h,
      handle,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState || !selectedSlot) return;
    const dx = (e.clientX - dragState.startX) / scale;
    const dy = (e.clientY - dragState.startY) / scale;

    if (dragState.type === 'move') {
      const newX = Math.max(0, Math.min(layout.width - dragState.origW, dragState.origX + dx));
      const newY = Math.max(0, Math.min(layout.height - dragState.origH, dragState.origY + dy));
      updateRegion(selectedSlot, { x: Math.round(newX), y: Math.round(newY) });
    } else if (dragState.type === 'resize') {
      let newW = dragState.origW;
      let newH = dragState.origH;
      let newX = dragState.origX;
      let newY = dragState.origY;

      if (dragState.handle?.includes('e')) newW = Math.max(20, dragState.origW + dx);
      if (dragState.handle?.includes('w')) {
        newW = Math.max(20, dragState.origW - dx);
        newX = dragState.origX + dx;
      }
      if (dragState.handle?.includes('s')) newH = Math.max(20, dragState.origH + dy);
      if (dragState.handle?.includes('n')) {
        newH = Math.max(20, dragState.origH - dy);
        newY = dragState.origY + dy;
      }

      newX = Math.max(0, newX);
      newY = Math.max(0, newY);
      newW = Math.min(newW, layout.width - newX);
      newH = Math.min(newH, layout.height - newY);

      updateRegion(selectedSlot, {
        x: Math.round(newX),
        y: Math.round(newY),
        w: Math.round(newW),
        h: Math.round(newH),
      });
    }
  };

  const handlePointerUp = () => {
    setDragState(null);
  };

  const containerHeight = layout.height * scale;
  const allSlots: LayoutSlot[] = ['couple', 'date', 'time', 'venue', 'guest', 'host', 'closing', 'photo'];
  const presentSlots = layout.regions.map((r) => r.slot);
  const missingSlots = allSlots.filter((s) => !presentSlots.includes(s));

  return (
    <div className="region-editor">
      <div
        ref={containerRef}
        className="region-editor__canvas"
        style={{ height: containerHeight }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={() => setSelectedSlot(null)}
      >
        <img src={imageUrl} alt="成品请柬" className="region-editor__image" />
        <div
          className="region-editor__overlay"
          style={{ transform: `scale(${scale})`, width: layout.width, height: layout.height }}
        >
          {layout.regions.map((region) => {
            const category = getSlotCategory(region.slot);
            const isSelected = selectedSlot === region.slot;
            return (
              <div
                key={region.slot}
                className={`region-box region-box--${category}${isSelected ? ' is-selected' : ''}${region.vertical ? ' is-vertical' : ''}`}
                style={{
                  left: region.x,
                  top: region.y,
                  width: region.w,
                  height: region.h,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSlot(region.slot);
                }}
                onPointerDown={(e) => handlePointerDown(e, region.slot, 'move')}
              >
                <span className="region-box__label">
                  {SLOT_LABELS[region.slot]}
                  {region.vertical ? ' 竖' : ''}
                </span>
                {isSelected && (
                  <>
                    <div className="resize-handle resize-handle--n" onPointerDown={(e) => handlePointerDown(e, region.slot, 'resize', 'n')} />
                    <div className="resize-handle resize-handle--s" onPointerDown={(e) => handlePointerDown(e, region.slot, 'resize', 's')} />
                    <div className="resize-handle resize-handle--e" onPointerDown={(e) => handlePointerDown(e, region.slot, 'resize', 'e')} />
                    <div className="resize-handle resize-handle--w" onPointerDown={(e) => handlePointerDown(e, region.slot, 'resize', 'w')} />
                    <div className="resize-handle resize-handle--ne" onPointerDown={(e) => handlePointerDown(e, region.slot, 'resize', 'ne')} />
                    <div className="resize-handle resize-handle--nw" onPointerDown={(e) => handlePointerDown(e, region.slot, 'resize', 'nw')} />
                    <div className="resize-handle resize-handle--se" onPointerDown={(e) => handlePointerDown(e, region.slot, 'resize', 'se')} />
                    <div className="resize-handle resize-handle--sw" onPointerDown={(e) => handlePointerDown(e, region.slot, 'resize', 'sw')} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="region-editor__controls">
        {selectedSlot && (
          <div className="region-editor__selected">
            <strong>{SLOT_LABELS[selectedSlot]}</strong>
            <div className="region-editor__actions">
              <button
                type="button"
                className={`btn btn--small${layout.regions.find((r) => r.slot === selectedSlot)?.vertical ? ' is-on' : ''}`}
                onClick={() => toggleVertical(selectedSlot)}
              >
                {layout.regions.find((r) => r.slot === selectedSlot)?.vertical ? '竖排 ✓' : '横排'}
              </button>
              {!REQUIRED_SLOTS.includes(selectedSlot) && (
                <button type="button" className="btn btn--small btn--danger" onClick={() => removeSlot(selectedSlot)}>
                  删除槽位
                </button>
              )}
            </div>
          </div>
        )}

        <div className="region-editor__slots">
          <p className="region-editor__slots-title">已有槽位：</p>
          <div className="region-editor__slot-list">
            {layout.regions.map((r) => (
              <span
                key={r.slot}
                className={`slot-tag slot-tag--${getSlotCategory(r.slot)}${selectedSlot === r.slot ? ' is-selected' : ''}`}
                onClick={() => setSelectedSlot(r.slot)}
              >
                {SLOT_LABELS[r.slot]}
              </span>
            ))}
          </div>
          {missingSlots.length > 0 && (
            <>
              <p className="region-editor__slots-title">添加槽位：</p>
              <div className="region-editor__slot-list">
                {missingSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className={`slot-tag slot-tag--add slot-tag--${getSlotCategory(slot)}`}
                    onClick={() => addSlot(slot)}
                  >
                    + {SLOT_LABELS[slot]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="region-editor__legend">
          <span className="legend-item legend-item--required">必需</span>
          <span className="legend-item legend-item--recommended">推荐</span>
          <span className="legend-item legend-item--optional">可选</span>
        </div>
      </div>
    </div>
  );
}

function PSChecklist() {
  return (
    <div className="ps-checklist">
      <h3>Photoshop 图层整理清单</h3>
      <p className="ps-checklist__desc">
        视觉解析已完成，请在 Cursor + Photoshop MCP 环境中完成以下图层整理工作：
      </p>
      <ol className="ps-checklist__list">
        <li>
          <strong>打开 PSD 原稿</strong>
          <p>在 Photoshop 中打开模板 PSD 文件</p>
        </li>
        <li>
          <strong>重命名图层</strong>
          <p>按规范将文案图层命名为小写英文槽位 ID：<code>couple</code>, <code>date</code>, <code>venue</code>, <code>time</code>, <code>guest</code>, <code>host</code>, <code>closing</code>, <code>photo</code></p>
        </li>
        <li>
          <strong>竖排标记</strong>
          <p>竖排文字图层名添加 <code>#vertical</code> 后缀，如 <code>couple#vertical</code></p>
        </li>
        <li>
          <strong>整理分组</strong>
          <p>装饰元素放入 <code>decor</code> 图层组，背景命名为 <code>bg</code> 或 <code>background</code></p>
        </li>
        <li>
          <strong>导出空白底图</strong>
          <p>隐藏所有文字槽位图层，导出为 <code>background.jpg</code>（保留装饰与背景）</p>
        </li>
      </ol>
      <div className="ps-checklist__note">
        <strong>📌 说明：</strong>本流程中 Photoshop MCP 调用暂不支持，上述步骤需在 Cursor Desktop + Photoshop 环境手动完成。
        完成后返回此页面发布模板。
      </div>
    </div>
  );
}

export function TemplateWorkbench() {
  const { refreshTemplates, setView } = useInvitation();
  const [step, setStep] = useState<WorkbenchStep>('upload');
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [samplePreview, setSamplePreview] = useState('');
  const [sampleDataUrl, setSampleDataUrl] = useState('');
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState('');
  const [layout, setLayout] = useState<TemplateLayout | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>(['自定义']);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [usedModel, setUsedModel] = useState(false);

  useEffect(() => {
    return () => {
      if (samplePreview) URL.revokeObjectURL(samplePreview);
      if (backgroundPreview) URL.revokeObjectURL(backgroundPreview);
    };
  }, [samplePreview, backgroundPreview]);

  const handleSampleUpload = async (file: File) => {
    setSampleFile(file);
    if (samplePreview) URL.revokeObjectURL(samplePreview);
    setSamplePreview(URL.createObjectURL(file));
    const dataUrl = await compressImage(file, { maxEdge: 1400, quality: 0.82, maxBytes: 800_000 });
    setSampleDataUrl(dataUrl);
  };

  const handleBackgroundUpload = (file: File) => {
    setBackgroundFile(file);
    if (backgroundPreview) URL.revokeObjectURL(backgroundPreview);
    setBackgroundPreview(URL.createObjectURL(file));
  };

  const analyzeImage = async () => {
    if (!sampleDataUrl) return;
    setBusy(true);
    setMessage('');
    try {
      const modelDataUrl = await compressImage(sampleFile!, { maxEdge: 1024, quality: 0.8, maxBytes: 800_000 });
      const result = await analyzeInvitation(modelDataUrl);
      const imageSize = await readImageSize(sampleDataUrl);
      const scaled = scaleLayout(result.layout, imageSize.width, imageSize.height);
      setLayout(scaled);
      setUsedModel(result.usedModel);
      setStep('adjust');
      setMessage(
        result.usedModel
          ? `已解析 ${scaled.regions.length} 个文案位置`
          : '未配置视觉模型 API key，已按常见版式自动估算'
      );
    } catch (err) {
      setMessage(friendlyStorageError(err));
    } finally {
      setBusy(false);
    }
  };

  const exportLayoutJson = () => {
    if (!layout) return;
    const json = JSON.stringify(layout, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, 'layout.json');
    URL.revokeObjectURL(url);
  };

  const exportSample = () => {
    if (!sampleDataUrl) return;
    downloadDataUrl(sampleDataUrl, 'sample.jpg');
  };

  const exportBackground = () => {
    if (backgroundPreview) {
      compressImage(backgroundFile!, { maxEdge: 1400, quality: 0.82, maxBytes: 800_000 })
        .then((dataUrl) => downloadDataUrl(dataUrl, 'background.jpg'))
        .catch(() => setMessage('背景图导出失败'));
    }
  };

  const hasVerticalRegion = layout?.regions.some((r) => r.vertical);

  const publishTemplate = async () => {
    if (!layout || !sampleFile) {
      setMessage('请先完成视觉解析');
      return;
    }
    if (!backgroundFile) {
      setMessage('请上传空白底图后再发布');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const templateTags = [...tags];
      if (hasVerticalRegion && !templateTags.includes('竖排')) {
        templateTags.push('竖排');
      }
      if (!hasVerticalRegion && !templateTags.includes('横排')) {
        templateTags.push('横排');
      }

      await api.uploadTemplateWithLayout({
        sampleFile,
        backgroundFile,
        name: name.trim() || '自定义模板',
        description: description.trim() || '开发者上传模板',
        tags: templateTags,
        layout,
      });
      await refreshTemplates();
      setMessage('模板已发布到用户端模板库！');
      setSampleFile(null);
      setBackgroundFile(null);
      setSamplePreview('');
      setBackgroundPreview('');
      setSampleDataUrl('');
      setLayout(null);
      setName('');
      setDescription('');
      setStep('upload');
    } catch (err) {
      setMessage(friendlyStorageError(err));
    } finally {
      setBusy(false);
    }
  };

  const missingRequired = REQUIRED_SLOTS.filter(
    (slot) => !layout?.regions.some((r) => r.slot === slot)
  );

  return (
    <section className="page page--workbench">
      <header className="page__head">
        <h2>开发者模板工作台</h2>
        <p>上传成品请柬 → 视觉解析 → 调整槽位 → 发布到用户端模板库</p>
      </header>

      <nav className="workbench-steps">
        <button
          type="button"
          className={`workbench-step${step === 'upload' ? ' is-current' : ''}`}
          onClick={() => setStep('upload')}
        >
          <i>1</i>
          <span>上传</span>
        </button>
        <button
          type="button"
          className={`workbench-step${step === 'adjust' ? ' is-current' : ''}${!layout ? ' is-disabled' : ''}`}
          onClick={() => layout && setStep('adjust')}
          disabled={!layout}
        >
          <i>2</i>
          <span>调框</span>
        </button>
        <button
          type="button"
          className={`workbench-step${step === 'ps-checklist' ? ' is-current' : ''}${!layout ? ' is-disabled' : ''}`}
          onClick={() => layout && setStep('ps-checklist')}
          disabled={!layout}
        >
          <i>3</i>
          <span>PS整理</span>
        </button>
        <button
          type="button"
          className={`workbench-step${step === 'publish' ? ' is-current' : ''}${!layout ? ' is-disabled' : ''}`}
          onClick={() => layout && setStep('publish')}
          disabled={!layout}
        >
          <i>4</i>
          <span>发布</span>
        </button>
      </nav>

      {step === 'upload' && (
        <div className="workbench-panel">
          <p className="file-pick-head">成品请柬（含文案和宾客名）</p>
          <label className={`file-pick${samplePreview ? ' has-preview' : ''}`}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleSampleUpload(file);
              }}
            />
            {samplePreview ? <img src={samplePreview} alt="成品请柬预览" /> : null}
            <span>{sampleFile ? `${sampleFile.name}` : '上传成品请柬 JPG / PNG'}</span>
          </label>

          <button
            type="button"
            className="btn btn--primary"
            disabled={!sampleFile || busy}
            onClick={() => void analyzeImage()}
          >
            {busy ? '正在解析…' : '视觉解析'}
          </button>
        </div>
      )}

      {step === 'adjust' && layout && (
        <div className="workbench-panel">
          <p className="hint">
            {usedModel ? '视觉模型已识别以下槽位，可拖动调整位置和大小：' : '按常见版式估算，请手动调整：'}
          </p>
          <RegionEditor layout={layout} imageUrl={samplePreview} onLayoutChange={setLayout} />

          {missingRequired.length > 0 && (
            <p className="error">缺少必需槽位：{missingRequired.map((s) => SLOT_LABELS[s]).join('、')}</p>
          )}

          <div className="workbench-nav">
            <button type="button" className="btn btn--ghost" onClick={() => setStep('upload')}>
              上一步
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={missingRequired.length > 0}
              onClick={() => setStep('ps-checklist')}
            >
              下一步
            </button>
          </div>
        </div>
      )}

      {step === 'ps-checklist' && (
        <div className="workbench-panel">
          <PSChecklist />
          <div className="workbench-nav">
            <button type="button" className="btn btn--ghost" onClick={() => setStep('adjust')}>
              上一步
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setStep('publish')}>
              下一步
            </button>
          </div>
        </div>
      )}

      {step === 'publish' && layout && (
        <div className="workbench-panel">
          <h3 className="subhead">导出三件套</h3>
          <div className="export-trio">
            <button type="button" className="btn btn--ghost" onClick={exportSample}>
              导出 sample.jpg
            </button>
            <button type="button" className="btn btn--ghost" onClick={exportLayoutJson}>
              导出 layout.json
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!backgroundFile}
              onClick={exportBackground}
            >
              导出 background.jpg
            </button>
          </div>

          <h3 className="subhead">上传空白底图</h3>
          <p className="hint">
            请在 Photoshop 中隐藏文字图层后导出空白底图，或直接上传已有底图。
          </p>
          <label className={`file-pick${backgroundPreview ? ' has-preview' : ''}`}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBackgroundUpload(file);
              }}
            />
            {backgroundPreview ? <img src={backgroundPreview} alt="空白底图预览" /> : null}
            <span>{backgroundFile ? `${backgroundFile.name}` : '上传空白底图 JPG / PNG'}</span>
          </label>

          <h3 className="subhead">模板信息</h3>
          <label className="block">
            模板名称
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：传统竖排请帖" />
          </label>
          <label className="block">
            简介
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="选填" />
          </label>
          <label className="block">
            标签（逗号分隔）
            <input
              value={tags.join(', ')}
              onChange={(e) => setTags(e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
              placeholder="自定义, 中式, 竖排"
            />
          </label>

          <div className="workbench-nav">
            <button type="button" className="btn btn--ghost" onClick={() => setStep('ps-checklist')}>
              上一步
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!backgroundFile || busy}
              onClick={() => void publishTemplate()}
            >
              {busy ? '发布中…' : '同步到用户端模板库'}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={message.includes('失败') || message.includes('缺少') ? 'error' : 'hint'}>
          {message}
        </p>
      )}

      <button type="button" className="btn btn--ghost workbench-back" onClick={() => setView('admin')}>
        返回模板管理
      </button>
    </section>
  );
}
