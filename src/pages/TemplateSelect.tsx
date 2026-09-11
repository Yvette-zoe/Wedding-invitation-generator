import { useInvitation } from '../context/InvitationContext';
import { ScaledCard } from '../components/InvitationCard';

export function TemplateSelect() {
  const {
    templates,
    templatesLoading,
    templateId,
    setTemplateId,
    selectedTemplate,
    content,
    previewGuest,
  } = useInvitation();

  return (
    <section className="page">
      <header className="page__head">
        <h2>选择请柬模板</h2>
        <p>左右滑动预览，点选后可进入填写文案。模板库支持后期上传更新。</p>
      </header>

      {templatesLoading ? <p className="hint">正在加载模板库…</p> : null}

      <div className="tpl-scroller" role="list">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            role="listitem"
            className={`tpl-slide ${tpl.id === templateId ? 'is-active' : ''}`}
            onClick={() => setTemplateId(tpl.id)}
          >
            <ScaledCard width={240} template={tpl} content={content} guest={previewGuest} />
            <span className="tpl-slide__name">{tpl.name}</span>
            {tpl.builtin ? null : <span className="tpl-slide__badge">自定义</span>}
          </button>
        ))}
      </div>

      {selectedTemplate ? (
        <div className="tpl-meta">
          <h3>{selectedTemplate.name}</h3>
          <p>{selectedTemplate.description}</p>
          <div className="tags">
            {selectedTemplate.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
