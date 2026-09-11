import { useState, type ChangeEvent } from 'react';
import { useInvitation } from '../context/InvitationContext';
import { PreviewFrame } from '../components/InvitationCard';
import { compressImage } from '../utils/image';

export function ContentForm() {
  const { content, setContent, selectedTemplate, previewGuest } = useInvitation();
  const [showPreview, setShowPreview] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');

  if (!selectedTemplate) return <p className="hint">请先选择模板</p>;

  const onPickPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError('');
    try {
      const photoUrl = await compressImage(file);
      setContent({ photoUrl });
      setShowPreview(true);
    } catch {
      setPhotoError('照片读取失败，请换一张再试');
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <section className="page">
      <header className="page__head">
        <h2>填写请柬文案</h2>
        <p>先插入婚纱照，再填写发给所有宾客的统一信息。宾客姓名会在下一步单独套打。</p>
      </header>

      <div className="photo-field">
        <span className="photo-field__label">新人婚纱照</span>
        <label className={`photo-pick${content.photoUrl ? ' has-photo' : ''}`}>
          <input
            type="file"
            accept="image/*"
            disabled={photoBusy}
            onChange={(e) => void onPickPhoto(e)}
          />
          {content.photoUrl ? (
            <img src={content.photoUrl} alt="已选婚纱照" />
          ) : (
            <span>{photoBusy ? '正在处理照片…' : '从相册插入，将显示在请柬中'}</span>
          )}
        </label>
        {content.photoUrl ? (
          <div className="photo-field__actions">
            <label className="btn btn--ghost photo-field__replace">
              <input type="file" accept="image/*" onChange={(e) => void onPickPhoto(e)} />
              更换照片
            </label>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setContent({ photoUrl: '' })}
            >
              移除
            </button>
          </div>
        ) : null}
        {photoError ? <p className="error">{photoError}</p> : null}
      </div>

      <button
        type="button"
        className="preview-toggle"
        onClick={() => setShowPreview((v) => !v)}
      >
        {showPreview ? '收起预览' : '展开预览'}
      </button>

      {showPreview ? (
        <PreviewFrame
          maxHeight={360}
          template={selectedTemplate}
          content={content}
          guest={previewGuest}
        />
      ) : null}

      <div className="field-grid">
        <label>
          新郎姓名
          <input
            value={content.groomName}
            onChange={(e) => setContent({ groomName: e.target.value })}
            autoComplete="off"
          />
        </label>
        <label>
          新娘姓名
          <input
            value={content.brideName}
            onChange={(e) => setContent({ brideName: e.target.value })}
            autoComplete="off"
          />
        </label>
      </div>

      <fieldset className="segment">
        <legend>姓名顺序</legend>
        <button
          type="button"
          className={content.coupleOrder === 'groom-first' ? 'is-on' : ''}
          onClick={() => setContent({ coupleOrder: 'groom-first' })}
        >
          新郎在前
        </button>
        <button
          type="button"
          className={content.coupleOrder === 'bride-first' ? 'is-on' : ''}
          onClick={() => setContent({ coupleOrder: 'bride-first' })}
        >
          新娘在前
        </button>
      </fieldset>

      <label className="block">
        请柬标题
        <input
          value={content.eventTitle}
          onChange={(e) => setContent({ eventTitle: e.target.value })}
        />
      </label>

      <label className="block">
        称谓前缀
        <input
          value={content.greetingPrefix}
          onChange={(e) => setContent({ greetingPrefix: e.target.value })}
          placeholder="尊敬的"
        />
      </label>

      <label className="block">
        正文
        <textarea
          rows={4}
          value={content.bodyText}
          onChange={(e) => setContent({ bodyText: e.target.value })}
        />
      </label>

      <div className="field-grid">
        <label>
          公历日期
          <input
            value={content.solarDate}
            onChange={(e) => setContent({ solarDate: e.target.value })}
          />
        </label>
        <label>
          农历日期
          <input
            value={content.lunarDate}
            onChange={(e) => setContent({ lunarDate: e.target.value })}
          />
        </label>
      </div>

      <label className="block">
        时间
        <input value={content.time} onChange={(e) => setContent({ time: e.target.value })} />
      </label>

      <label className="block">
        宴会地点
        <input value={content.venue} onChange={(e) => setContent({ venue: e.target.value })} />
      </label>

      <label className="block">
        详细地址
        <input value={content.address} onChange={(e) => setContent({ address: e.target.value })} />
      </label>

      <label className="block">
        结尾敬语
        <input value={content.closing} onChange={(e) => setContent({ closing: e.target.value })} />
      </label>

      <label className="block">
        落款
        <input
          value={content.hostNames}
          onChange={(e) => setContent({ hostNames: e.target.value })}
        />
      </label>
    </section>
  );
}
