import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useInvitation } from '../context/InvitationContext';
import { InvitationCard, PreviewFrame } from '../components/InvitationCard';
import { cardToJpeg, downloadDataUrl, nextPaint, zipJpegs } from '../utils/exportJpg';
import { safeFileName } from '../utils/id';

export function ExportStudio() {
  const {
    selectedTemplate,
    content,
    guests,
    previewGuest,
    previewGuestId,
    setPreviewGuestId,
    setStep,
  } = useInvitation();
  const exportRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  if (!selectedTemplate) return <p className="hint">请先选择模板</p>;

  const captureCurrent = async () => {
    const el = exportRef.current;
    if (!el) throw new Error('导出画板未就绪');
    await nextPaint();
    return cardToJpeg(el);
  };

  const exportOne = async () => {
    setError('');
    setBusy(true);
    setProgress('正在生成当前请柬…');
    try {
      const dataUrl = await captureCurrent();
      downloadDataUrl(dataUrl, `${safeFileName(previewGuest.name)}的请柬.jpg`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const exportAll = async () => {
    if (!guests.length) {
      setError('请先添加宾客');
      return;
    }
    setError('');
    setBusy(true);
    const originalGuestId = previewGuestId;
    const files: { name: string; dataUrl: string }[] = [];
    try {
      for (let i = 0; i < guests.length; i += 1) {
        const guest = guests[i];
        setProgress(`正在导出 ${i + 1}/${guests.length} · ${guest.name || '未命名'}`);
        flushSync(() => setPreviewGuestId(guest.id));
        const dataUrl = await captureCurrent();
        files.push({ name: `${guest.name || '宾客'}_${i + 1}`, dataUrl });
      }
      await zipJpegs(files, '婚礼请柬.zip');
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量导出失败');
    } finally {
      // 导出过程会挨个切换预览宾客，结束后换回用户原来选的那一份
      flushSync(() => setPreviewGuestId(originalGuestId));
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <section className="page">
      <header className="page__head">
        <h2>预览并导出 JPG</h2>
        <p>点选宾客后，用底部按钮导出单张或全部打包。</p>
      </header>

      <div className="guest-pills">
        {guests.map((guest) => (
          <button
            key={guest.id}
            type="button"
            className={guest.id === previewGuestId ? 'is-on' : ''}
            onClick={() => setPreviewGuestId(guest.id)}
          >
            {[guest.name, guest.honorific].filter(Boolean).join(' ') || '未命名'}
          </button>
        ))}
      </div>

      <PreviewFrame
        maxHeight={380}
        template={selectedTemplate}
        content={content}
        guest={previewGuest}
      />

      {progress ? <p className="hint">{progress}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <footer className="dock">
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setStep(3)}>
          上一步
        </button>
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void exportOne()}>
          导出当前
        </button>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void exportAll()}>
          {busy ? '导出中…' : `全部导出`}
        </button>
      </footer>

      {busy ? (
        <div className="mask" role="status">
          {progress || '正在导出…'}
        </div>
      ) : null}

      {/* 原尺寸画板移出视口，保证 JPG 清晰，且仍会被浏览器绘制 */}
      <div className="export-stage">
        <InvitationCard
          cardRef={exportRef}
          template={selectedTemplate}
          content={content}
          guest={previewGuest}
        />
      </div>
    </section>
  );
}
