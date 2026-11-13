import { create } from 'zustand';
import {
  COLORS,
  newTier,
  newSession,
  newQuestion,
  slugKey,
  toLocalInput,
} from './eventEditorConstants';

const initialInfo = {
  title: '',
  category: '',
  venueName: '',
  city: '',
  description: '',
  organizerInfo: '',
  allowResale: false,
  maxResaleMarkupPct: 10,
};

export const useEventEditorStore = create((set, get) => ({
  step: 1,
  editing: false,
  status: 'DRAFT',
  loading: false,
  saving: false,
  categories: [],
  info: { ...initialInfo },
  banner: null,
  thumb: null,
  legalDoc: null,
  hasLegalDoc: false,
  sessions: [newSession()],
  questions: [],

  setStep: (step) => set({ step: typeof step === 'function' ? step(get().step) : step }),
  setEditing: (editing) => set({ editing }),
  setStatus: (status) => set({ status }),
  setLoading: (loading) => set({ loading }),
  setSaving: (saving) => set({ saving }),
  setCategories: (categories) => set({ categories }),

  setInfo: (info) => set({ info: typeof info === 'function' ? info(get().info) : info }),
  updateInfoField: (key, value) =>
    set((state) => ({ info: { ...state.info, [key]: value } })),

  setBanner: (banner) => set({ banner }),
  setThumb: (thumb) => set({ thumb }),
  setLegalDoc: (legalDoc) => set({ legalDoc }),
  setHasLegalDoc: (hasLegalDoc) => set({ hasLegalDoc }),

  // Sessions actions
  setSessions: (sessions) =>
    set({ sessions: typeof sessions === 'function' ? sessions(get().sessions) : sessions }),
  addSession: () =>
    set((state) => ({ sessions: [...state.sessions, newSession()] })),
  removeSession: (index) =>
    set((state) => ({ sessions: state.sessions.filter((_, j) => j !== index) })),
  updateSession: (index, patch) =>
    set((state) => ({
      sessions: state.sessions.map((s, j) => (j === index ? { ...s, ...patch } : s)),
    })),

  // Tiers actions
  addTier: (sessionIndex) =>
    set((state) => ({
      sessions: state.sessions.map((s, j) =>
        j === sessionIndex ? { ...s, tiers: [...s.tiers, newTier(s.tiers.length)] } : s,
      ),
    })),
  removeTier: (sessionIndex, tierIndex) =>
    set((state) => ({
      sessions: state.sessions.map((s, j) =>
        j === sessionIndex
          ? { ...s, tiers: s.tiers.filter((_, m) => m !== tierIndex) }
          : s,
      ),
    })),
  updateTier: (sessionIndex, tierIndex, patch) =>
    set((state) => ({
      sessions: state.sessions.map((s, j) =>
        j === sessionIndex
          ? {
              ...s,
              tiers: s.tiers.map((t, m) => (m === tierIndex ? { ...t, ...patch } : t)),
            }
          : s,
      ),
    })),

  // Questions actions
  setQuestions: (questions) =>
    set({ questions: typeof questions === 'function' ? questions(get().questions) : questions }),
  addQuestion: () =>
    set((state) => ({ questions: [...state.questions, newQuestion()] })),
  removeQuestion: (index) =>
    set((state) => ({ questions: state.questions.filter((_, j) => j !== index) })),
  updateQuestion: (index, patch) =>
    set((state) => ({
      questions: state.questions.map((q, j) => (j === index ? { ...q, ...patch } : q)),
    })),

  resetForm: () =>
    set({
      step: 1,
      editing: false,
      status: 'DRAFT',
      loading: false,
      saving: false,
      info: { ...initialInfo },
      banner: null,
      thumb: null,
      legalDoc: null,
      hasLegalDoc: false,
      sessions: [newSession()],
      questions: [],
    }),

  initFromEvent: (event) => {
    set({
      status: event.status,
      hasLegalDoc: Boolean(event.hasLegalDoc),
      info: {
        title: event.title || '',
        category: '',
        venueName: event.venueName || '',
        city: event.city || '',
        description: event.description || '',
        organizerInfo: event.organizerInfo || '',
        allowResale: Boolean(event.allowResale),
        maxResaleMarkupPct: event.maxResaleMarkupPct ?? 10,
      },
      questions: (event.customFormSchema || []).map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: Boolean(f.required),
        optionsText: (f.options || []).join(', '),
      })),
      sessions: (event.sessions || []).map((s) => ({
        id: s._id,
        name: s.name,
        startTime: toLocalInput(s.startTime),
        endTime: toLocalInput(s.endTime),
        tiers: (s.tiers || []).map((t) => ({
          id: t._id,
          name: t.name,
          price: t.price,
          quantity: t.totalQuantity ?? t.total_quantity ?? t.quantity,
          zoneType: t.zoneType || t.zone_type || 'GA',
          color: t.zoneColor || COLORS[0],
          minPerOrder: t.minPerOrder ?? 1,
          maxPerOrder: t.maxPerOrder ?? 6,
        })),
      })),
    });
  },

  buildSchema: () => {
    const { questions } = get();
    return questions.map((q) => ({
      key: q.key.trim() || slugKey(q.label),
      label: q.label.trim(),
      type: q.type,
      required: q.required,
      ...(q.type === 'select'
        ? { options: q.optionsText.split(',').map((o) => o.trim()).filter(Boolean) }
        : {}),
    }));
  },

  validate: (stepNumber, forSubmit) => {
    const { info, editing, status, banner, legalDoc, hasLegalDoc, sessions, questions, buildSchema } =
      get();
    const structural = !editing || status === 'DRAFT';

    if (stepNumber === 1 && structural) {
      if (!info.title.trim()) return 'Vui lòng nhập tên sự kiện';
      if (!info.venueName.trim()) return 'Vui lòng nhập địa điểm';
      if (!info.city.trim()) return 'Vui lòng nhập thành phố';
      if (!editing && !banner) return 'Vui lòng chọn ảnh bìa sự kiện';
      if (forSubmit && !legalDoc && !hasLegalDoc)
        return 'Vui lòng tải lên giấy phép tổ chức sự kiện trước khi gửi duyệt';
    }

    if (stepNumber === 2 && structural) {
      if (!sessions.length) return 'Cần ít nhất 1 suất diễn';
      for (const [i, se] of sessions.entries()) {
        if (!se.startTime) return `Suất ${i + 1}: chọn giờ bắt đầu`;
        if (se.endTime && new Date(se.endTime) <= new Date(se.startTime))
          return `Suất ${i + 1}: giờ kết thúc phải sau giờ bắt đầu`;
        if (forSubmit && new Date(se.startTime) <= new Date())
          return `Suất ${i + 1}: giờ bắt đầu phải ở tương lai`;
        if (!se.tiers.length) return `Suất ${i + 1}: cần ít nhất 1 hạng vé`;
        for (const [k, t] of se.tiers.entries()) {
          if (!t.name.trim()) return `Suất ${i + 1}, hạng vé ${k + 1}: nhập tên`;
          if (t.price === '' || Number(t.price) < 0)
            return `Suất ${i + 1}, hạng vé ${k + 1}: giá không hợp lệ`;
          if (!Number.isInteger(Number(t.quantity)) || Number(t.quantity) < 1)
            return `Suất ${i + 1}, hạng vé ${k + 1}: số lượng phải ≥ 1`;
          if (Number(t.minPerOrder) > Number(t.maxPerOrder))
            return `Suất ${i + 1}, hạng vé ${k + 1}: tối thiểu không được lớn hơn tối đa`;
        }
      }
    }

    if (stepNumber === 4 && structural) {
      for (const [i, q] of questions.entries()) {
        if (!q.label.trim()) return `Câu hỏi ${i + 1}: nhập nội dung`;
        if (q.type === 'select' && q.optionsText.split(',').filter((o) => o.trim()).length < 2)
          return `Câu hỏi ${i + 1}: lựa chọn cần ít nhất 2 phương án (ngăn cách bằng dấu phẩy)`;
      }
      const keys = buildSchema().map((q) => q.key);
      if (new Set(keys).size !== keys.length)
        return 'Có hai câu hỏi trùng nhau, hãy đổi nội dung một câu';
    }

    return '';
  },
}));
