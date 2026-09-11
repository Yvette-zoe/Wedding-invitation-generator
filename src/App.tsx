import { InvitationProvider, useInvitation, type WizardStep } from './context/InvitationContext';
import { TemplateSelect } from './pages/TemplateSelect';
import { ContentForm } from './pages/ContentForm';
import { GuestManager } from './pages/GuestManager';
import { ExportStudio } from './pages/ExportStudio';
import { TemplateAdmin } from './pages/TemplateAdmin';

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 1, label: '模板' },
  { id: 2, label: '文案' },
  { id: 3, label: '宾客' },
  { id: 4, label: '导出' },
];

function Shell() {
  const { view, setView, step, setStep, templateId, guests } = useInvitation();

  const canNext =
    (step === 1 && Boolean(templateId)) ||
    step === 2 ||
    (step === 3 && guests.length > 0);

  const nextLabel =
    step === 1 ? '使用此模板' : step === 2 ? '下一步 · 宾客' : step === 3 ? '下一步 · 导出' : '';

  return (
    <div className={`app ${view === 'admin' ? 'app--admin' : ''}`}>
      <header className="topbar">
        <div>
          <p className="topbar__en">Wedding Atelier</p>
          <h1>禧 · 请柬工坊</h1>
        </div>
        {view === 'wizard' ? (
          <button type="button" className="topbar__link" onClick={() => setView('admin')}>
            模板库
          </button>
        ) : (
          <button type="button" className="topbar__link" onClick={() => setView('wizard')}>
            返回
          </button>
        )}
      </header>

      {view === 'admin' ? (
        <main className="main">
          <TemplateAdmin />
        </main>
      ) : (
        <>
          <nav className="steps" aria-label="制作步骤">
            {STEPS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`steps__item ${step === item.id ? 'is-current' : ''} ${step > item.id ? 'is-done' : ''}`}
                onClick={() => {
                  if (item.id <= step || (item.id === 2 && templateId)) setStep(item.id);
                }}
              >
                <i>{item.id}</i>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <main className="main">
            {step === 1 ? <TemplateSelect /> : null}
            {step === 2 ? <ContentForm /> : null}
            {step === 3 ? <GuestManager /> : null}
            {step === 4 ? <ExportStudio /> : null}
          </main>

          {step < 4 ? (
            <footer className="dock">
              {step > 1 ? (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setStep((step - 1) as WizardStep)}
                >
                  上一步
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                className="btn btn--primary"
                disabled={!canNext}
                onClick={() => setStep((step + 1) as WizardStep)}
              >
                {nextLabel}
              </button>
            </footer>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <InvitationProvider>
      <Shell />
    </InvitationProvider>
  );
}
