export const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];

export const FIELD_TYPES = [
  { v: 'text', t: 'Văn bản ngắn' },
  { v: 'textarea', t: 'Văn bản dài' },
  { v: 'number', t: 'Số' },
  { v: 'select', t: 'Lựa chọn' },
  { v: 'checkbox', t: 'Ô tick' },
];

export const toLocalInput = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
};

export const newTier = (i = 0) => ({
  name: '',
  price: '',
  quantity: '',
  zoneType: 'GA',
  color: COLORS[i % COLORS.length],
  minPerOrder: 1,
  maxPerOrder: 6,
});

export const newSession = () => ({
  name: '',
  startTime: '',
  endTime: '',
  tiers: [newTier()],
});

export const newQuestion = () => ({
  key: '',
  label: '',
  type: 'text',
  required: false,
  optionsText: '',
});

export const slugKey = (s) => {
  const base = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w.toLowerCase()))
    .join('');
  return /^[a-zA-Z]/.test(base) ? base.slice(0, 40) : `q${base}`.slice(0, 40);
};

export const STEPS = ['Thông tin', 'Suất diễn & vé', 'Sơ đồ (tùy chọn)', 'Form người tham dự', 'Xem lại'];
