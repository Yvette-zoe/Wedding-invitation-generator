import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_CONTENT, type Guest, type InvitationContent, type Template } from '../types';
import { createId } from '../utils/id';
import { idbGet, idbSet } from '../utils/idb';
import { api } from '../api/client';

export type WizardStep = 1 | 2 | 3 | 4;
export type AppView = 'wizard' | 'admin' | 'workbench';

const DRAFT_KEY = 'wedding-invitation-draft';

const SAMPLE_GUESTS: Guest[] = [
  { id: createId('gst'), name: '海英 老于', honorific: '' },
  { id: createId('gst'), name: '叶子', honorific: '' },
  { id: createId('gst'), name: '老王 杨老师', honorific: '' },
  { id: createId('gst'), name: '老梦', honorific: '' },
];

interface Draft {
  step: WizardStep;
  templateId: string;
  content: InvitationContent;
  guests: Guest[];
  previewGuestId: string;
}

interface InvitationContextValue {
  view: AppView;
  setView: (view: AppView) => void;
  step: WizardStep;
  setStep: (step: WizardStep) => void;
  templates: Template[];
  templatesLoading: boolean;
  refreshTemplates: () => Promise<void>;
  templateId: string;
  setTemplateId: (id: string) => void;
  selectedTemplate: Template | undefined;
  content: InvitationContent;
  setContent: (patch: Partial<InvitationContent>) => void;
  guests: Guest[];
  setGuests: (guests: Guest[]) => void;
  addGuest: (guest?: Partial<Guest>) => void;
  updateGuest: (id: string, patch: Partial<Guest>) => void;
  removeGuest: (id: string) => void;
  previewGuestId: string;
  setPreviewGuestId: (id: string) => void;
  previewGuest: Guest;
  loadSampleGuests: () => void;
}

const InvitationContext = createContext<InvitationContextValue | null>(null);

function loadDraft(): Partial<Draft> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : {};
  } catch {
    return {};
  }
}

function normalizeGuests(list: Guest[] | undefined): Guest[] | undefined {
  if (!list?.length) return undefined;
  return list.map((item) => ({
    id: item.id,
    name: item.name,
    honorific: item.honorific,
  }));
}

export function InvitationProvider({ children }: { children: ReactNode }) {
  const cached = loadDraft();
  const [view, setView] = useState<AppView>('wizard');
  const [step, setStep] = useState<WizardStep>(cached.step ?? 1);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateId, setTemplateId] = useState(cached.templateId ?? 'tpl_crimson');
  const [content, setContentState] = useState<InvitationContent>(() => {
    const merged = cached.content ? { ...DEFAULT_CONTENT, ...cached.content } : DEFAULT_CONTENT;
    if (!merged.photoUrl.startsWith('data:') && !merged.photoUrl.startsWith('blob:')) {
      return { ...merged, photoUrl: '' };
    }
    return merged;
  });
  const [guests, setGuests] = useState<Guest[]>(normalizeGuests(cached.guests) ?? SAMPLE_GUESTS);
  const [previewGuestId, setPreviewGuestId] = useState(
    cached.previewGuestId ?? SAMPLE_GUESTS[0]?.id ?? '',
  );

  const refreshTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const list = await api.listTemplates();
      setTemplates(list);
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    void refreshTemplates();
  }, []);

  // 初次从 IndexedDB 读取婚纱照完成前，禁止下面的保存副作用写回，避免用空值把已存的照片冲掉
  const photoLoadedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void idbGet<string>('invitation-photo')
      .then((url) => {
        if (cancelled || !url) return;
        setContentState((prev) => (prev.photoUrl ? prev : { ...prev, photoUrl: url }));
      })
      .finally(() => {
        if (!cancelled) photoLoadedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const draft: Draft = {
      step,
      templateId,
      content: { ...content, photoUrl: content.photoUrl ? '1' : '' },
      guests,
      previewGuestId,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* 草稿不含大图，一般不会超配额 */
    }
  }, [step, templateId, content, guests, previewGuestId]);

  useEffect(() => {
    if (!photoLoadedRef.current) return;
    void idbSet('invitation-photo', content.photoUrl || '').catch(() => undefined);
  }, [content.photoUrl]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === templateId) ?? templates[0],
    [templates, templateId],
  );

  const previewGuest = useMemo(() => {
    return guests.find((item) => item.id === previewGuestId) ?? guests[0] ?? {
      id: 'preview',
      name: '宾客',
      honorific: '',
    };
  }, [guests, previewGuestId]);

  const value: InvitationContextValue = {
    view,
    setView,
    step,
    setStep,
    templates,
    templatesLoading,
    refreshTemplates,
    templateId,
    setTemplateId,
    selectedTemplate,
    content,
    setContent: (patch) => setContentState((prev) => ({ ...prev, ...patch })),
    guests,
    setGuests,
    addGuest: (guest) => {
      const next: Guest = {
        id: createId('gst'),
        name: guest?.name ?? '',
        honorific: guest?.honorific ?? '',
      };
      setGuests((prev) => [next, ...prev]);
      setPreviewGuestId(next.id);
    },
    updateGuest: (id, patch) => {
      setGuests((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    },
    removeGuest: (id) => {
      setGuests((prev) => {
        const next = prev.filter((item) => item.id !== id);
        if (previewGuestId === id) setPreviewGuestId(next[0]?.id ?? '');
        return next;
      });
    },
    previewGuestId,
    setPreviewGuestId,
    previewGuest,
    loadSampleGuests: () => {
      const list = SAMPLE_GUESTS.map((item) => ({ ...item, id: createId('gst') }));
      setGuests(list);
      setPreviewGuestId(list[0]?.id ?? '');
    },
  };

  return <InvitationContext.Provider value={value}>{children}</InvitationContext.Provider>;
}

export function useInvitation() {
  const ctx = useContext(InvitationContext);
  if (!ctx) throw new Error('useInvitation 必须在 InvitationProvider 内使用');
  return ctx;
}
