import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Loader2, Upload } from 'lucide-react';
import DOMPurify from 'dompurify';
import { api } from '../../api/client';
import { eventsService } from '../../services/events.service';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';
import { inputCls } from '../../components/FormField';
import SeatmapPreview from '../../features/seatmap/SeatmapPreview';
import SeatMapView from '../../features/seatmap/SeatMapView';
import { colorSections } from '../../features/seatmap/colors';

// Kiểu bố trí chỗ (đầu bước 2). Quyết định sự kiện có sơ đồ hay không và dựng bằng cách nào.
const LAYOUT_MODES = [
  { k: 'NONE', t: 'Không sơ đồ', d: 'Workshop, hội thảo. Khách chọn hạng vé và số lượng.' },
  { k: 'GA_SVG', t: 'Vé đứng', d: 'Chỉ cần file SVG mặt bằng. Mỗi khu trong SVG gắn với một hạng vé, sức chứa lấy từ số lượng vé.' },
  { k: 'SEATED_FILE', t: 'Vé ngồi', d: 'Cần file SVG mặt bằng và file Excel. Hạng vé và số ghế được đọc tự động từ Excel.' },
];

const label = 'block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5';
const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];
const FIELD_TYPES = [
  { v: 'text', t: 'Văn bản ngắn' },
  { v: 'textarea', t: 'Văn bản dài' },
  { v: 'number', t: 'Số' },
  { v: 'select', t: 'Lựa chọn' },
  { v: 'checkbox', t: 'Ô tick' },
];
// datetime-local (giờ máy khách) <-> ISO
const toLocalInput = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
};
const newTier = (i = 0) => ({ name: '', price: '', quantity: '', zoneType: 'GA', color: COLORS[i % COLORS.length], minPerOrder: 1, maxPerOrder: 6, saleStart: '', saleEnd: '' });
const newSession = () => ({ name: '', startTime: '', endTime: '', tiers: [newTier()] });
const newQuestion = () => ({ key: '', label: '', type: 'text', required: false, optionsText: '' });
const slugKey = (s) => {
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

/**
 * Tạo sự kiện (UC22, UC25, UC26) — 5 bước (bước 3 chọn kiểu bố trí chỗ). Chế độ sửa (/organizer/events/:id/edit) chỉ cho phép sửa
 * những gì backend cho phép theo trạng thái (DRAFT: sửa hết cấu trúc; đã duyệt: chỉ mô tả).
 */
export default function CreateEventPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { showToast } = useToast();

    const [step, setStep] = useState(1);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('DRAFT');
  const [info, setInfo] = useState({ title: '', category: '', venueName: '', city: '', description: '', organizerInfo: '', allowResale: false, maxResaleMarkupPct: 10 });
  const [banner, setBanner] = useState(null);
  const [legalDoc, setLegalDoc] = useState(null);
  const [hasLegalDoc, setHasLegalDoc] = useState(false);
  const [thumb, setThumb] = useState(null);
  const [sessions, setSessions] = useState([newSession()]);
  const [questions, setQuestions] = useState([]);
  const [layoutMode, setLayoutMode] = useState('NONE'); // NONE | GA_SVG | SEATED_FILE (chỉ dùng khi tạo mới, chọn ở bước 2)
  const [svgFile, setSvgFile] = useState(null);
  const [xlsxFile, setXlsxFile] = useState(null);
  const [svgSections, setSvgSections] = useState([]); // id các khu SEC_ đọc từ SVG
  const [zoneMap, setZoneMap] = useState({}); // { sectionId: tên hạng vé } (chỉ vé đứng)
  const [seatedTiers, setSeatedTiers] = useState([]); // hạng vé đọc từ Excel: [{ name, quantity }] (chỉ vé ngồi)
  const [seatPreview, setSeatPreview] = useState(null); // kết quả /seatmap/parse
  const [parsing, setParsing] = useState(false);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  // 4 bước. Bố trí chỗ nằm trong bước 2: khi tạo mới thì chọn + tải file, khi sửa thì chỉ xem bản vẽ đã lưu.
  const stepKeys = ['info', 'sessions', 'form', 'review'];
  const stepKey = stepKeys[step - 1];
  const tierType = layoutMode === 'SEATED_FILE' ? 'SEATED' : 'GA'; // loại vé do kiểu bố trí chỗ quyết định, không trộn đứng với ngồi

  const structural = !editing || status === 'DRAFT';
  const seatedLocked = !editing && layoutMode === 'SEATED_FILE'; // tên + số lượng hạng vé do file Excel quyết định

  useEffect(() => {
    eventsService
      .categories()
      .then((r) => {
        const list = r.categories || [];
        setCategories(list);
        if (!editing && list[0]) setInfo((p) => ({ ...p, category: p.category || list[0].name }));
      })
      .catch(() => {});
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    api
      .get(`/organizer/events/${id}`)
      .then((r) => {
        const e = r.event;
        setStatus(e.status);
        setHasLegalDoc(Boolean(e.hasLegalDoc));
        setInfo({
          title: e.title || '',
          category: '',
          venueName: e.venueName || '',
          city: e.city || '',
          description: e.description || '',
          organizerInfo: e.organizerInfo || '',
          allowResale: Boolean(e.allowResale),
          maxResaleMarkupPct: e.maxResaleMarkupPct ?? 10,
        });
        setQuestions(
          (e.customFormSchema || []).map((f) => ({ key: f.key, label: f.label, type: f.type, required: Boolean(f.required), optionsText: (f.options || []).join(', ') })),
        );
        setSessions(
          (e.sessions || []).map((s) => ({
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
              saleStart: toLocalInput(t.saleStartTime),
              saleEnd: toLocalInput(t.saleEndTime),
            })),
          })),
        );
      })
      .catch((err) => {
        showToast(err.message || 'Không tải được sự kiện');
        navigate(PATHS.ORGANIZER_EVENTS);
      })
      .finally(() => setLoading(false));
  }, [editing, id, navigate, showToast]);

  const setI = (k) => (e) => setInfo({ ...info, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const upSession = (i, patch) => setSessions((p) => p.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  // Vé ngồi: giá, màu, tối thiểu/tối đa dùng chung mọi suất (sửa một chỗ); giờ mở/đóng bán vẫn riêng từng suất
  const SHARED = ['price', 'color', 'minPerOrder', 'maxPerOrder'];
  const upTier = (i, k, patch) =>
    setSessions((p) =>
      p.map((s, j) => {
        const sharedPatch = seatedLocked ? Object.fromEntries(Object.entries(patch).filter(([key]) => SHARED.includes(key))) : {};
        const own = j === i ? patch : sharedPatch;
        return Object.keys(own).length ? { ...s, tiers: s.tiers.map((t, m) => (m === k ? { ...t, ...own } : t)) } : s;
      }),
    );
  // Dựng danh sách hạng vé từ file, giữ giá/màu/giờ bán đã nhập theo tên hạng
  const tiersFromFile = (list, old = []) =>
    list.map((ft, i) => {
      const prev = old.find((t) => t.name.trim().toLowerCase() === ft.name.toLowerCase());
      return { ...(prev || newTier(i)), name: ft.name, quantity: ft.quantity };
    });
  const addSession = () =>
    setSessions((p) => [
      ...p,
      seatedLocked && seatedTiers.length
        ? { ...newSession(), tiers: tiersFromFile(seatedTiers, p[0]?.tiers).map((t) => ({ ...t, saleStart: '', saleEnd: '' })) }
        : newSession(),
    ]);
  const upQ = (i, patch) => setQuestions((p) => p.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  // Có sơ đồ thì mọi suất dùng chung một mặt bằng: sao chép hạng vé của suất 1 sang các suất còn lại (giữ tên suất, giờ; giữ giờ mở/đóng bán riêng từng suất)
  const copyTiersFromFirst = () =>
    setSessions((p) => p.map((s, i) => (i === 0 ? s : { ...s, tiers: p[0].tiers.map((t) => ({ ...t, saleStart: '', saleEnd: '' })) })));

  const resetFiles = () => {
    setSvgFile(null);
    setXlsxFile(null);
    setSvgSections([]);
    setZoneMap({});
    setSeatedTiers([]);
    setSeatPreview(null);
  };

  const changeMode = (k) => {
    if (k === layoutMode) return;
    if (k === 'SEATED_FILE' && !editing && sessions.some((x) => x.tiers.some((t) => t.name.trim() || t.price !== ''))) {
      if (!window.confirm('Chọn "Vé ngồi" sẽ thay danh sách hạng vé bằng dữ liệu đọc từ file Excel. Tiếp tục?')) return;
    }
    resetFiles();
    setLayoutMode(k);
  };

  // Vé ngồi: gửi cả 2 file lên backend để đọc (cùng bộ luật kiểm tra khi lưu), nhận hạng vé + bản xem trước
  const parseSeated = async (svg, xlsx) => {
    if (!svg || !xlsx) return;
    const fd = new FormData();
    fd.append('svgFile', svg);
    fd.append('excelFile', xlsx);
    setParsing(true);
    setSeatPreview(null);
    try {
      const r = await api.post('/organizer/seatmap/parse', fd);
      setSeatPreview({ ok: true, ...r });
      setSeatedTiers(r.tiers);
      if (!editing) setSessions((prev) => prev.map((x) => ({ ...x, tiers: tiersFromFile(r.tiers, x.tiers) })));
    } catch (err) {
      setSeatedTiers([]);
      setSeatPreview({ ok: false, message: err.message, details: err.data?.details });
    } finally {
      setParsing(false);
    }
  };

  const pickSvg = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return showToast('File quá lớn (tối đa 5MB)');
    const doc = new DOMParser().parseFromString(await f.text(), 'image/svg+xml');
    if (doc.querySelector('parsererror') || !doc.querySelector('svg')) return showToast('File SVG không hợp lệ');
    const ids = [...doc.querySelectorAll('[id^="SEC_"]')].map((n) => n.getAttribute('id'));
    if (!ids.length) return showToast('SVG không có khu nào có id bắt đầu bằng "SEC_"');
    if (new Set(ids).size !== ids.length) return showToast('SVG có id khu bị trùng');
    setSvgFile(f);
    setSvgSections(ids);
    setZoneMap({});
    if (layoutMode === 'SEATED_FILE') parseSeated(f, xlsxFile);
  };
  const pickXlsx = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) return showToast('File Excel phải là .xlsx');
    if (f.size > 5 * 1024 * 1024) return showToast('File quá lớn (tối đa 5MB)');
    setXlsxFile(f);
    parseSeated(svgFile, f);
  };

  const pickLegalDoc = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type)) {
      showToast('Giấy phép phải là ảnh JPG, PNG, WEBP hoặc PDF');
      e.target.value = '';
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      showToast('Tệp quá lớn (tối đa 10MB)');
      e.target.value = '';
      return;
    }
    setLegalDoc(f);
  };

  const uploadLegalDoc = async (eventId) => {
    const fd = new FormData();
    fd.append('document', legalDoc);
    await api.put(`/organizer/events/${eventId}/legal-doc`, fd);
  };

  const pickImage = (setter) => (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      showToast('Ảnh phải là JPG, PNG hoặc WEBP');
      e.target.value = '';
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      showToast('Ảnh quá lớn (tối đa 5MB)');
      e.target.value = '';
      return;
    }
    setter(f);
  };

  const buildSchema = () =>
    questions.map((q) => ({
      key: q.key.trim() || slugKey(q.label),
      label: q.label.trim(),
      type: q.type,
      required: q.required,
      ...(q.type === 'select' ? { options: q.optionsText.split(',').map((o) => o.trim()).filter(Boolean) } : {}),
    }));

  // Kiểm tra phần bố trí chỗ (khi tạo mới và khi thay sơ đồ ở bản nháp)
  const layoutError = () => {
    const first = sessions[0];
    if (layoutMode === 'NONE') return '';
    if (!svgFile) return 'Bố trí chỗ: hãy chọn file SVG mặt bằng';
    if (layoutMode === 'GA_SVG') {
      const used = svgSections.map((id) => zoneMap[id]);
      if (used.some((v) => !v)) return 'Vé đứng: hãy gắn mỗi khu trong SVG với một hạng vé';
      if (new Set(used).size !== used.length) return 'Vé đứng: mỗi hạng vé chỉ gắn với một khu';
      const lack = first.tiers.find((t) => !used.includes(t.name.trim()));
      if (lack) return `Vé đứng: hạng vé "${lack.name}" chưa gắn với khu nào trong SVG`;
    }
    if (layoutMode === 'SEATED_FILE') {
      if (!xlsxFile) return 'Vé ngồi: hãy chọn thêm file Excel';
      if (parsing) return 'Đang đọc file, vui lòng chờ';
      if (!seatedTiers.length) return seatPreview?.message || 'Vé ngồi: file chưa hợp lệ';
    }
    if (!editing) {
      const sig = (x) => JSON.stringify(x.tiers.map((t) => t.name.trim().toLowerCase()).sort());
      const bad = sessions.findIndex((x) => sig(x) !== sig(first));
      if (bad > 0) return `Suất ${bad + 1} có danh sách hạng vé khác suất 1. Sơ đồ dùng chung cho mọi suất`;
      const names = first.tiers.map((t) => t.name.trim().toLowerCase());
      if (new Set(names).size !== names.length) return 'Tên hạng vé không được trùng nhau trong một suất khi có sơ đồ';
    }
    return '';
  };

  // Bản nháp: thay sơ đồ bằng file mới (hạng vé hiện có phải khớp file)
  const saveLayout = async () => {
    const err = layoutError();
    if (err) return showToast(err);
    const fd = new FormData();
    fd.append('seatLayout', layoutMode);
    fd.append('svgFile', svgFile);
    if (layoutMode === 'SEATED_FILE') fd.append('excelFile', xlsxFile);
    if (layoutMode === 'GA_SVG') fd.append('seatZones', JSON.stringify(svgSections.map((sid) => ({ sectionId: sid, tierName: zoneMap[sid] }))));
    setLayoutSaving(true);
    try {
      await api.put(`/organizer/events/${id}/seatmap`, fd);
      showToast('Đã thay sơ đồ');
      resetFiles();
      setPreviewKey((k) => k + 1);
    } catch (e) {
      showToast(e.data?.details ? `${e.message}: ${JSON.stringify(e.data.details)}` : e.message || 'Không thay được sơ đồ');
    } finally {
      setLayoutSaving(false);
    }
  };

  // Trả về thông báo lỗi của bước, hoặc '' nếu hợp lệ
  const validate = (s, forSubmit) => {
    if (s === 'info' && structural) {
      if (!info.title.trim()) return 'Vui lòng nhập tên sự kiện';
      if (!info.venueName.trim()) return 'Vui lòng nhập địa điểm';
      if (!info.city.trim()) return 'Vui lòng nhập thành phố';
      if (!editing && !banner) return 'Vui lòng chọn ảnh bìa sự kiện';
      if (forSubmit && !legalDoc && !hasLegalDoc) return 'Vui lòng tải lên giấy phép tổ chức sự kiện trước khi gửi duyệt';
    }
    if (s === 'sessions' && structural) {
      if (!sessions.length) return 'Cần ít nhất 1 suất diễn';
      for (const [i, se] of sessions.entries()) {
        if (!se.startTime) return `Suất ${i + 1}: chọn giờ bắt đầu`;
        if (se.endTime && new Date(se.endTime) <= new Date(se.startTime)) return `Suất ${i + 1}: giờ kết thúc phải sau giờ bắt đầu`;
        if (forSubmit && new Date(se.startTime) <= new Date()) return `Suất ${i + 1}: giờ bắt đầu phải ở tương lai`;
        if (!se.tiers.length) return `Suất ${i + 1}: cần ít nhất 1 hạng vé`;
        for (const [k, t] of se.tiers.entries()) {
          if (!t.name.trim()) return `Suất ${i + 1}, hạng vé ${k + 1}: nhập tên`;
          if (t.price === '' || Number(t.price) < 0) return `Suất ${i + 1}, hạng vé ${k + 1}: giá không hợp lệ`;
          if (!Number.isInteger(Number(t.quantity)) || Number(t.quantity) < 1) return `Suất ${i + 1}, hạng vé ${k + 1}: số lượng phải ≥ 1`;
          if (Number(t.minPerOrder) > Number(t.maxPerOrder)) return `Suất ${i + 1}, hạng vé ${k + 1}: tối thiểu không được lớn hơn tối đa`;
          const at = `Suất ${i + 1}, hạng vé ${k + 1}`;
          const open = t.saleStart ? new Date(t.saleStart) : null;
          const close = t.saleEnd ? new Date(t.saleEnd) : null;
          const start = new Date(se.startTime);
          if (open && close && close <= open) return `${at}: giờ đóng bán phải sau giờ mở bán`;
          if (open && open >= start) return `${at}: giờ mở bán phải trước giờ bắt đầu suất`;
          if (close && close > start) return `${at}: giờ đóng bán không được sau giờ bắt đầu suất`;
          if (forSubmit && close && close <= new Date()) return `${at}: giờ đóng bán đã qua`;
        }
      }
    }
    if (s === 'sessions' && !editing) return layoutError();
    if (s === 'form' && structural) {
      for (const [i, q] of questions.entries()) {
        if (!q.label.trim()) return `Câu hỏi ${i + 1}: nhập nội dung`;
        if (q.type === 'select' && q.optionsText.split(',').filter((o) => o.trim()).length < 2) return `Câu hỏi ${i + 1}: lựa chọn cần ít nhất 2 phương án (ngăn cách bằng dấu phẩy)`;
      }
      const keys = buildSchema().map((q) => q.key);
      if (new Set(keys).size !== keys.length) return 'Có hai câu hỏi trùng nhau, hãy đổi nội dung một câu';
    }
    return '';
  };

  const next = () => {
    const err = validate(stepKey, false);
    if (err) return showToast(err);
    setStep((s) => s + 1);
  };

  const save = async (asDraft) => {
    for (const [si, s] of stepKeys.filter((k) => k !== 'review').entries()) {
      const err = validate(s, !asDraft);
      if (err) {
        setStep(si + 1);
        return showToast(err);
      }
    }
    setSaving(true);
    try {
      if (editing) {
        const body = { description: info.description, organizerInfo: info.organizerInfo };
        if (structural) {
          Object.assign(body, {
            title: info.title.trim(),
            venueName: info.venueName.trim(),
            city: info.city.trim(),
            allowResale: info.allowResale,
            maxResaleMarkupPct: Number(info.maxResaleMarkupPct),
            customFormSchema: buildSchema(),
            ...(info.category ? { category: info.category } : {}),
          });
        }
        await api.put(`/organizer/events/${id}`, body);
        if (banner || thumb) {
          const fd = new FormData();
          if (banner) fd.append('backgroundImage', banner);
          if (thumb) fd.append('eventImage', thumb);
          await api.put(`/organizer/events/${id}/images`, fd);
        }
        if (legalDoc && ['DRAFT', 'PENDING'].includes(status)) {
          await uploadLegalDoc(id);
          setHasLegalDoc(true);
          setLegalDoc(null);
        }
        showToast('Đã lưu thay đổi');
      } else {
        const payload = {
          title: info.title.trim(),
          category: info.category,
          venueName: info.venueName.trim(),
          city: info.city.trim(),
          description: info.description,
          organizerInfo: info.organizerInfo,
          allowResale: info.allowResale,
          maxResaleMarkupPct: Number(info.maxResaleMarkupPct),
          customFormSchema: buildSchema(),
          saveAsDraft: true, // luôn tạo bản nháp trước: cần mã sự kiện để tải giấy phép, rồi mới gửi duyệt
          ...(layoutMode !== 'NONE' ? { seatLayout: layoutMode } : {}), // backend dựng sơ đồ ngay trong lúc tạo, lỗi thì rollback cả sự kiện
          ...(layoutMode === 'GA_SVG' ? { seatZones: svgSections.map((id) => ({ sectionId: id, tierName: zoneMap[id] })) } : {}),
          sessions: sessions.map((s) => ({
            name: s.name.trim() || undefined,
            startTime: new Date(s.startTime).toISOString(),
            endTime: s.endTime ? new Date(s.endTime).toISOString() : undefined,
            tickets: s.tiers.map((t) => ({
              name: t.name.trim(),
              price: Number(t.price),
              totalQuantity: Number(t.quantity),
              zoneType: tierType,
              zoneColor: t.color,
              minPerOrder: Number(t.minPerOrder),
              maxPerOrder: Number(t.maxPerOrder),
              ...(t.saleStart ? { saleStartTime: new Date(t.saleStart).toISOString() } : {}),
              ...(t.saleEnd ? { saleEndTime: new Date(t.saleEnd).toISOString() } : {}),
            })),
          })),
        };
        const fd = new FormData();
        fd.append('data', JSON.stringify(payload));
        if (banner) fd.append('backgroundImage', banner);
        if (thumb) fd.append('eventImage', thumb);
        if (layoutMode !== 'NONE' && svgFile) fd.append('svgFile', svgFile);
        if (layoutMode === 'SEATED_FILE' && xlsxFile) fd.append('excelFile', xlsxFile);
        const r = await api.post('/events', fd);
        const newId = r.eventId;
        if (legalDoc) {
          try {
            await uploadLegalDoc(newId);
          } catch (err) {
            showToast(`Đã lưu nháp nhưng chưa tải được giấy phép: ${err.message}`);
            navigate(`/organizer/events/${newId}/edit`, { replace: true });
            return;
          }
        }
        if (!asDraft) {
          try {
            await api.post(`/organizer/events/${newId}/submit`, {});
            showToast('Đã gửi Admin duyệt');
            navigate(PATHS.ORGANIZER_EVENTS);
          } catch (err) {
            showToast(`Đã lưu nháp nhưng chưa gửi duyệt được: ${err.message}`);
            navigate(`/organizer/events/${newId}/edit`, { replace: true });
          }
          return;
        }
        showToast(layoutMode !== 'NONE' ? 'Đã lưu bản nháp và dựng sơ đồ' : r.message || 'Đã lưu bản nháp');
        navigate(`/organizer/events/${newId}/edit`, { replace: true });
        return;
      }
      navigate(PATHS.ORGANIZER_EVENTS);
    } catch (err) {
      showToast(err.message || 'Không lưu được sự kiện');
    } finally {
      setSaving(false);
    }
  };

  const stepNames = { info: 'Thông tin', sessions: 'Suất diễn, vé & bố trí chỗ', form: 'Form người tham dự', review: 'Xem lại' };
  const steps = stepKeys.map((k) => stepNames[k]);
  const preview = useMemo(() => DOMPurify.sanitize(info.description || ''), [info.description]);

  if (loading)
    return (
      <div className='text-[#71717a] flex items-center gap-2 py-10'>
        <Loader2 size={16} className='animate-spin' /> Đang tải...
      </div>
    );

  return (
    <div className='max-w-4xl space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>{editing ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện mới'}</h1>
        {editing && !structural && (
          <p className='text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2'>
            Sự kiện đã {status === 'PENDING' ? 'gửi duyệt' : 'được duyệt'}, chỉ sửa được mô tả và thông tin tổ chức.
            {status === 'PENDING' && ' Hãy rút lại về bản nháp nếu cần sửa nhiều hơn.'}
          </p>
        )}
      </div>

      <ol className='flex flex-wrap gap-2'>
        {steps.map((t, i) => (
          <li key={t}>
            <button
              type='button'
              onClick={() => (i + 1 < step ? setStep(i + 1) : undefined)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                step === i + 1 ? 'bg-[#09090b] text-white border-[#09090b]' : i + 1 < step ? 'bg-white border-[#09090b] text-[#09090b]' : 'bg-white border-[#e4e4e7] text-[#71717a]'
              }`}>
              {i + 1}. {t}
            </button>
          </li>
        ))}
      </ol>

      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-6 space-y-5'>
        {stepKey === 'info' && (
          <>
            <div>
              <label htmlFor='e-title' className={label}>Tên sự kiện</label>
              <input id='e-title' disabled={!structural} className={inputCls} value={info.title} onChange={setI('title')} maxLength={255} />
            </div>
            <div className='grid gap-4 sm:grid-cols-3'>
              <div>
                <label htmlFor='e-cat' className={label}>Danh mục</label>
                <select id='e-cat' disabled={!structural} className={inputCls} value={info.category} onChange={setI('category')}>
                  {editing && <option value=''>(giữ nguyên)</option>}
                  {categories.map((c) => (
                    <option key={c._id || c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor='e-venue' className={label}>Địa điểm</label>
                <input id='e-venue' disabled={!structural} className={inputCls} value={info.venueName} onChange={setI('venueName')} />
              </div>
              <div>
                <label htmlFor='e-city' className={label}>Thành phố</label>
                <input id='e-city' disabled={!structural} className={inputCls} value={info.city} onChange={setI('city')} />
              </div>
            </div>
            <div>
              <label htmlFor='e-desc' className={label}>Mô tả (hỗ trợ HTML cơ bản)</label>
              <textarea id='e-desc' rows={6} className={inputCls} value={info.description} onChange={setI('description')} />
            </div>
            <div>
              <label htmlFor='e-org' className={label}>Thông tin đơn vị tổ chức</label>
              <textarea id='e-org' rows={2} className={inputCls} value={info.organizerInfo} onChange={setI('organizerInfo')} />
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              {[
                ['Ảnh bìa (banner)', banner, setBanner],
                ['Ảnh đại diện (thumbnail)', thumb, setThumb],
              ].map(([t, f, setter]) => (
                <div key={t}>
                  <div className={label}>{t}{!editing && t.startsWith('Ảnh bìa') && ' *'}</div>
                  <label className='tb-btn tb-btn-outline cursor-pointer'>
                    <Upload size={14} /> {f ? 'Đổi ảnh' : 'Chọn ảnh'}
                    <input type='file' accept='image/jpeg,image/png,image/webp' className='hidden' onChange={pickImage(setter)} />
                  </label>
                  <p className='text-xs text-[#71717a] mt-2'>{f ? f.name : editing ? 'Giữ ảnh hiện tại nếu không chọn' : 'JPG, PNG, WEBP, tối đa 5MB'}</p>
                </div>
              ))}
            </div>
            <div className='border-t border-[#f4f4f6] pt-4 space-y-2'>
              <div className={label}>Giấy phép tổ chức sự kiện (bắt buộc khi gửi duyệt)</div>
              {editing && !['DRAFT', 'PENDING'].includes(status) ? (
                <p className='text-xs text-[#71717a]'>{hasLegalDoc ? 'Đã nộp giấy phép.' : 'Chưa có giấy phép.'} Sự kiện đã được duyệt nên không thay được.</p>
              ) : (
                <>
                  <label className='tb-btn tb-btn-outline cursor-pointer'>
                    <Upload size={14} /> {legalDoc ? 'Đổi tệp' : hasLegalDoc ? 'Thay giấy phép' : 'Chọn tệp'}
                    <input type='file' accept='image/jpeg,image/png,image/webp,application/pdf' className='hidden' onChange={pickLegalDoc} />
                  </label>
                  <p className='text-xs text-[#71717a]'>
                    {legalDoc
                      ? legalDoc.name
                      : hasLegalDoc
                        ? 'Đã có giấy phép trên hệ thống (lưu riêng tư, chỉ Admin duyệt xem được). Chọn tệp mới nếu muốn thay.'
                        : 'Giấy phép biểu diễn / tổ chức sự kiện do cơ quan có thẩm quyền cấp. JPG, PNG, WEBP hoặc PDF, tối đa 10MB.'}
                  </p>
                </>
              )}
            </div>
            <div className='border-t border-[#f4f4f6] pt-4 space-y-3'>
              <label className='flex items-center gap-2.5 text-sm cursor-pointer'>
                <input type='checkbox' disabled={!structural} className='w-4 h-4 accent-[#09090b]' checked={info.allowResale} onChange={setI('allowResale')} />
                Cho phép khách bán lại vé trên chợ chính thức
              </label>
              {info.allowResale && (
                <div className='max-w-xs'>
                  <label htmlFor='e-markup' className={label}>Giá bán lại tối đa (+% so với giá gốc)</label>
                  <input id='e-markup' type='number' min='0' max='100' disabled={!structural} className={inputCls} value={info.maxResaleMarkupPct} onChange={setI('maxResaleMarkupPct')} />
                </div>
              )}
            </div>
          </>
        )}

        {stepKey === 'sessions' && (
          <div className='space-y-6'>
            {editing && structural && (
              <p className='text-xs text-[#71717a]'>
                Ở chế độ sửa, suất diễn và hạng vé hiển thị để xem. Muốn đổi, hãy dùng chức năng thêm / sửa suất diễn khi sự kiện còn là bản nháp.
              </p>
            )}
            {(!editing || status === 'DRAFT') && (
              <div className='border border-[#e4e4e7] rounded-xl p-4 space-y-4'>
                <div>
                  <h3 className='font-bold'>Bố trí chỗ</h3>
                  <p className='text-xs text-[#71717a] mt-1'>
                    {editing
                      ? 'Sơ đồ hiện tại ở bên dưới. Chọn kiểu và tải file mới để thay thế (hạng vé phải khớp với file).'
                      : 'Chọn trước để hệ thống biết loại vé. Áp dụng cho mọi suất diễn, tải file ngay ở đây.'}
                  </p>
                </div>
                {editing && <SeatmapPreview key={previewKey} eventId={id} scope='organizer' />}
                <div className='grid gap-3 sm:grid-cols-3'>
                  {LAYOUT_MODES.filter((m) => !editing || m.k !== 'NONE').map((m) => (
                    <button
                      key={m.k}
                      type='button'
                      onClick={() => changeMode(m.k)}
                      className={`text-left border rounded-xl p-4 space-y-1 ${layoutMode === m.k ? 'border-[#09090b] bg-[#f4f4f6]' : 'border-[#e4e4e7] hover:border-[#09090b]'}`}>
                      <div className='font-bold text-sm'>{m.t}</div>
                      <div className='text-xs text-[#52525b]'>{m.d}</div>
                    </button>
                  ))}
                </div>

                {layoutMode === 'NONE' && !editing && <p className='text-xs text-[#71717a]'>Khách chọn hạng vé và số lượng, không có mặt bằng.</p>}

                {layoutMode !== 'NONE' && (
                  <div className='space-y-4'>
                    {!editing && layoutMode === 'GA_SVG' && sessions.length > 1 && (
                      <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={copyTiersFromFirst}>
                        Dùng hạng vé của suất 1 cho mọi suất
                      </button>
                    )}
                    <div className='grid gap-4 sm:grid-cols-2'>
                      <div>
                        <div className={label}>File SVG mặt bằng *</div>
                        <label className='tb-btn tb-btn-outline cursor-pointer'>
                          <Upload size={14} /> {svgFile ? 'Đổi tệp' : 'Chọn tệp'}
                          <input type='file' accept='.svg,image/svg+xml' className='hidden' onChange={pickSvg} />
                        </label>
                        <p className='text-xs text-[#71717a] mt-2 break-all'>
                          {svgFile ? `${svgFile.name} (${svgSections.length} khu)` : 'Mỗi khu có id bắt đầu SEC_, sân khấu STAGE_. Tối đa 5MB'}
                        </p>
                      </div>
                      {layoutMode === 'SEATED_FILE' && (
                        <div>
                          <div className={label}>File Excel khu / ghế *</div>
                          <label className='tb-btn tb-btn-outline cursor-pointer'>
                            <Upload size={14} /> {xlsxFile ? 'Đổi tệp' : 'Chọn tệp'}
                            <input type='file' accept='.xlsx' className='hidden' onChange={pickXlsx} />
                          </label>
                          <p className='text-xs text-[#71717a] mt-2 break-all'>
                            {xlsxFile ? xlsxFile.name : 'Tối đa 5MB. Tên hạng vé và số ghế lấy từ cột Tier_Name và các hàng ghế'}
                          </p>
                        </div>
                      )}
                    </div>
                    <p className='flex flex-wrap gap-3 text-xs'>
                      <a className='underline' href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/v1'}/organizer/seatmap/template.svg`}>File SVG mẫu</a>
                      {layoutMode === 'SEATED_FILE' && (
                        <a className='underline' href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/v1'}/organizer/seatmap/template.xlsx`}>File Excel mẫu</a>
                      )}
                    </p>

                    {layoutMode === 'SEATED_FILE' && parsing && (
                      <div className='text-[#71717a] flex items-center gap-2 text-sm'>
                        <Loader2 size={14} className='animate-spin' /> Đang đọc file...
                      </div>
                    )}
                    {layoutMode === 'SEATED_FILE' && seatPreview && !seatPreview.ok && (
                      <div className='text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-1'>
                        <div className='font-semibold'>{seatPreview.message}</div>
                        {seatPreview.details && (
                          <ul className='list-disc pl-5 space-y-0.5'>
                            {(Array.isArray(seatPreview.details)
                              ? seatPreview.details
                              : Object.entries(seatPreview.details).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
                            ).map((d, i) => (
                              <li key={i}>{typeof d === 'string' ? d : JSON.stringify(d)}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    {layoutMode === 'SEATED_FILE' && seatPreview?.ok && (
                      <div className='space-y-2'>
                        <p className='text-xs text-[#52525b]'>
                          Đọc được {seatPreview.summary.sections.length} khu, {seatPreview.summary.seatedPerSession} ghế mỗi suất. Hạng vé: {seatPreview.tiers.map((t) => `${t.name} (${t.quantity})`).join(', ')}
                        </p>
                        <SeatMapView
                          svgContent={seatPreview.svgContent}
                          sections={colorSections(seatPreview.summary.sections.map((x) => ({ ...x, status: 'AVAILABLE', available: x.capacity, total: x.capacity, price: 0 })))}
                          seats={seatPreview.seats || []}
                        />
                      </div>
                    )}

                    {layoutMode === 'GA_SVG' && svgSections.length > 0 && (
                      <div className='space-y-2'>
                        <div className={label}>Gắn khu với hạng vé (sức chứa = số lượng vé)</div>
                        {svgSections.map((sid) => (
                          <div key={sid} className='grid gap-2 sm:grid-cols-[1fr_1fr] items-center'>
                            <span className='text-sm font-mono'>{sid}</span>
                            <select className={inputCls} value={zoneMap[sid] || ''} onChange={(e) => setZoneMap((p) => ({ ...p, [sid]: e.target.value }))}>
                              <option value=''>— chọn hạng vé —</option>
                              {sessions[0].tiers.filter((t) => t.name.trim()).map((t) => (
                                <option key={t.name} value={t.name.trim()}>{t.name.trim()}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    )}

                    {editing && (
                      <button type='button' className='tb-btn tb-btn-solid' disabled={layoutSaving || parsing} onClick={saveLayout}>
                        {layoutSaving ? 'Đang lưu...' : 'Thay sơ đồ'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {editing && status !== 'DRAFT' && (
              <div className='border border-[#e4e4e7] rounded-xl p-4 space-y-3'>
                <h3 className='font-bold'>Bố trí chỗ</h3>
                <SeatmapPreview eventId={id} scope='organizer' />
              </div>
            )}
            {seatedLocked && !seatedTiers.length && <p className='text-sm text-[#71717a] border border-dashed border-[#d4d4d8] rounded-xl p-4'>Tải file SVG và Excel ở trên để hệ thống tạo danh sách hạng vé.</p>}
            {sessions.map((s, i) => (
              <div key={s.id || i} className='border border-[#e4e4e7] rounded-xl p-4 space-y-4'>
                <div className='flex items-center justify-between'>
                  <h3 className='font-bold'>Suất diễn {i + 1}</h3>
                  {!editing && sessions.length > 1 && (
                    <button type='button' className='text-xs text-red-700 flex items-center gap-1' onClick={() => setSessions((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 size={13} /> Xóa suất
                    </button>
                  )}
                </div>
                <div className='grid gap-4 sm:grid-cols-3'>
                  <div>
                    <label className={label}>Tên suất</label>
                    <input disabled={editing} className={inputCls} value={s.name} onChange={(e) => upSession(i, { name: e.target.value })} placeholder={`Suất diễn ${i + 1}`} />
                  </div>
                  <div>
                    <label className={label}>Bắt đầu</label>
                    <input type='datetime-local' disabled={editing} className={inputCls} value={s.startTime} onChange={(e) => upSession(i, { startTime: e.target.value })} />
                  </div>
                  <div>
                    <label className={label}>Kết thúc (tùy chọn)</label>
                    <input type='datetime-local' disabled={editing} className={inputCls} value={s.endTime} onChange={(e) => upSession(i, { endTime: e.target.value })} />
                  </div>
                </div>

                <div className='space-y-3'>
                  {(!seatedLocked || seatedTiers.length > 0) && s.tiers.map((t, k) => (
                    <div key={t.id || k} className={`grid gap-3 ${editing ? 'sm:grid-cols-[1.4fr_1fr_0.8fr_0.9fr_auto]' : 'sm:grid-cols-[1.6fr_1fr_0.8fr_auto]'} items-end bg-[#f9f9fb] rounded-lg p-3`}>
                      <div>
                        <label className={label}>Hạng vé</label>
                        <input disabled={editing || seatedLocked} className={inputCls} value={t.name} onChange={(e) => upTier(i, k, { name: e.target.value })} placeholder='VIP, Thường...' />
                      </div>
                      <div>
                        <label className={label}>Giá (₫)</label>
                        <input type='number' min='0' disabled={editing} className={inputCls} value={t.price} onChange={(e) => upTier(i, k, { price: e.target.value })} />
                      </div>
                      <div>
                        <label className={label}>Số lượng</label>
                        <input type='number' min='1' disabled={editing || seatedLocked} className={inputCls} value={t.quantity} onChange={(e) => upTier(i, k, { quantity: e.target.value })} />
                      </div>
                      {editing && (
                      <div>
                        <label className={label}>Loại</label>
                        <select disabled={editing} className={inputCls} value={t.zoneType} onChange={(e) => upTier(i, k, { zoneType: e.target.value })}>
                          <option value='GA'>Vé đứng</option>
                          <option value='SEATED'>Ghế đánh số</option>
                        </select>
                      </div>
                      )}
                      <div className='flex items-center gap-2'>
                        <input type='color' disabled={editing} value={t.color} onChange={(e) => upTier(i, k, { color: e.target.value })} className='w-9 h-9 rounded border border-[#e4e4e7] bg-white' aria-label='Màu khu' />
                        {!editing && !seatedLocked && s.tiers.length > 1 && (
                          <button type='button' aria-label='Xóa hạng vé' className='text-red-700' onClick={() => upSession(i, { tiers: s.tiers.filter((_, m) => m !== k) })}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                      <div className='sm:col-span-5 grid gap-3 sm:grid-cols-2'>
                        <div>
                          <label className={label}>Mở bán (để trống = ngay khi duyệt)</label>
                          <input type='datetime-local' disabled={editing} className={inputCls} value={t.saleStart} max={s.startTime || undefined} onChange={(e) => upTier(i, k, { saleStart: e.target.value })} />
                        </div>
                        <div>
                          <label className={label}>Đóng bán (để trống = lúc suất bắt đầu)</label>
                          <input type='datetime-local' disabled={editing} className={inputCls} value={t.saleEnd} max={s.startTime || undefined} onChange={(e) => upTier(i, k, { saleEnd: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {!editing && !seatedLocked && (
                    <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => upSession(i, { tiers: [...s.tiers, newTier(s.tiers.length)] })}>
                      <Plus size={13} /> Thêm hạng vé
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!editing && (
              <button type='button' className='tb-btn tb-btn-outline' onClick={addSession}>
                <Plus size={14} /> Thêm suất diễn
              </button>
            )}
          </div>
        )}

        {stepKey === 'form' && (
          <div className='space-y-4'>
            <p className='text-sm text-[#52525b]'>Câu hỏi khách phải trả lời khi đặt vé (tối đa 20). Có thể bỏ trống nếu không cần.</p>
            {questions.map((q, i) => (
              <div key={i} className='border border-[#e4e4e7] rounded-xl p-4 grid gap-3 sm:grid-cols-[2fr_1fr_auto]'>
                <div>
                  <label className={label}>Câu hỏi {i + 1}</label>
                  <input disabled={!structural} className={inputCls} value={q.label} onChange={(e) => upQ(i, { label: e.target.value })} placeholder='Ví dụ: Họ tên người tham dự' />
                </div>
                <div>
                  <label className={label}>Kiểu</label>
                  <select disabled={!structural} className={inputCls} value={q.type} onChange={(e) => upQ(i, { type: e.target.value })}>
                    {FIELD_TYPES.map((f) => (
                      <option key={f.v} value={f.v}>
                        {f.t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className='flex items-end gap-3'>
                  <label className='flex items-center gap-1.5 text-xs pb-2.5 cursor-pointer'>
                    <input type='checkbox' disabled={!structural} className='w-4 h-4 accent-[#09090b]' checked={q.required} onChange={(e) => upQ(i, { required: e.target.checked })} /> Bắt buộc
                  </label>
                  {structural && (
                    <button type='button' aria-label='Xóa câu hỏi' className='text-red-700 pb-2.5' onClick={() => setQuestions((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                {q.type === 'select' && (
                  <div className='sm:col-span-3'>
                    <label className={label}>Các lựa chọn (ngăn cách bằng dấu phẩy)</label>
                    <input disabled={!structural} className={inputCls} value={q.optionsText} onChange={(e) => upQ(i, { optionsText: e.target.value })} placeholder='S, M, L, XL' />
                  </div>
                )}
              </div>
            ))}
            {structural && questions.length < 20 && (
              <button type='button' className='tb-btn tb-btn-outline' onClick={() => setQuestions((p) => [...p, newQuestion()])}>
                <Plus size={14} /> Thêm câu hỏi
              </button>
            )}
          </div>
        )}

        {stepKey === 'review' && (
          <div className='space-y-4 text-sm'>
            <div className='grid gap-3 sm:grid-cols-2'>
              {[
                ['Tên sự kiện', info.title],
                ['Địa điểm', `${info.venueName}, ${info.city}`],
                ['Số suất diễn', sessions.length],
                ['Số hạng vé', sessions.reduce((n, s) => n + s.tiers.length, 0)],
                ['Số câu hỏi', questions.length],
                ['Sơ đồ chỗ', editing ? 'Quản lý ở bước Sơ đồ' : LAYOUT_MODES.find((m) => m.k === layoutMode)?.t],
                ['Giấy phép', legalDoc ? legalDoc.name : hasLegalDoc ? 'Đã nộp' : 'Chưa có'],
                ['Bán lại vé', info.allowResale ? `Cho phép, tối đa +${info.maxResaleMarkupPct}%` : 'Không'],
              ].map(([k, v]) => (
                <div key={k} className='bg-[#f9f9fb] rounded-lg p-3'>
                  <div className='text-[11px] uppercase tracking-wider text-[#71717a]'>{k}</div>
                  <div className='font-semibold'>{v || '—'}</div>
                </div>
              ))}
            </div>
            {preview && <div className='border border-[#e4e4e7] rounded-lg p-3 max-h-40 overflow-y-auto' dangerouslySetInnerHTML={{ __html: preview }} />}
            <p className='text-xs text-[#71717a]'>
              {editing
                ? 'Bấm Lưu thay đổi để cập nhật.'
                : 'Lưu nháp để sửa tiếp sau, hoặc Gửi duyệt để Admin xét. Sau khi Admin duyệt, bạn sẽ ký hợp đồng điện tử và sự kiện được mở bán.'}
            </p>
          </div>
        )}
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <button type='button' disabled={step === 1} className='tb-btn tb-btn-outline' onClick={() => setStep((s) => s - 1)}>
          Quay lại
        </button>
        <div className='flex flex-wrap gap-3'>
          {step < steps.length ? (
            <button type='button' className='tb-btn tb-btn-solid' onClick={next}>
              Tiếp tục
            </button>
          ) : editing ? (
            <button type='button' disabled={saving} className='tb-btn tb-btn-solid' onClick={() => save(true)}>
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          ) : (
            <>
              <button type='button' disabled={saving} className='tb-btn tb-btn-outline' onClick={() => save(true)}>
                Lưu bản nháp
              </button>
              <button type='button' disabled={saving} className='tb-btn tb-btn-solid' onClick={() => save(false)}>
                {saving ? 'Đang gửi...' : 'Gửi duyệt'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
