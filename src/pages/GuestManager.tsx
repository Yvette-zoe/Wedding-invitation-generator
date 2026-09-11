import { useState } from 'react';
import { displayGuestLine } from '../types';
import { useInvitation } from '../context/InvitationContext';
import { createId } from '../utils/id';

/** 一行一份请柬，整行作为称谓里的名字，空格表示多人 */
function parseGuestText(raw: string) {
  return raw
    .split(/\n+/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .map((name) => ({ name, honorific: '' }));
}

export function GuestManager() {
  const {
    content,
    guests,
    addGuest,
    updateGuest,
    removeGuest,
    setGuests,
    previewGuestId,
    setPreviewGuestId,
    loadSampleGuests,
  } = useInvitation();
  const [bulk, setBulk] = useState('');
  const [showBulk, setShowBulk] = useState(true);

  const importBulk = () => {
    const parsed = parseGuestText(bulk);
    if (!parsed.length) return;
    const next = parsed.map((item) => ({ ...item, id: createId('gst') }));
    setGuests([...next, ...guests]);
    setPreviewGuestId(next[0].id);
    setBulk('');
    setShowBulk(false);
  };

  return (
    <section className="page">
      <header className="page__head">
        <h2>宾客名单</h2>
        <p>一行生成一份请柬。同一行可写多人名字，会原样印成「尊敬的 海英 老于」。</p>
      </header>

      <div className="guest-toolbar">
        <button type="button" className="btn btn--ghost" onClick={() => addGuest()}>
          添加一份
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setShowBulk((v) => !v)}>
          {showBulk ? '关闭导入' : '批量导入'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={loadSampleGuests}>
          示例名单
        </button>
      </div>

      {showBulk ? (
        <div className="bulk-box">
          <textarea
            rows={6}
            placeholder={'每行一份请柬，例如：\n海英 老于\n叶子\n老王 杨老师\n老梦'}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
          />
          <button type="button" className="btn btn--primary" onClick={importBulk} disabled={!parseGuestText(bulk).length}>
            {parseGuestText(bulk).length ? `导入 ${parseGuestText(bulk).length} 份` : '粘贴名单后导入'}
          </button>
        </div>
      ) : null}

      <p className="hint">共 {guests.length} 份请柬 · 点选可预览该份称谓</p>

      <ul className="guest-list">
        {guests.map((guest) => (
          <li
            key={guest.id}
            className={`guest-card ${guest.id === previewGuestId ? 'is-active' : ''}`}
            onClick={() => setPreviewGuestId(guest.id)}
          >
            <textarea
              className="guest-card__name"
              rows={2}
              placeholder="海英 老于"
              value={guest.name}
              onChange={(e) => updateGuest(guest.id, { name: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />
            <p className="guest-card__preview">{displayGuestLine(content, guest)}</p>
            <button
              type="button"
              className="guest-card__del"
              onClick={(e) => {
                e.stopPropagation();
                removeGuest(guest.id);
              }}
            >
              删除
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
