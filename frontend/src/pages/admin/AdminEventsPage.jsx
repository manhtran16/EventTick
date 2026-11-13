import { useCallback, useEffect, useState } from 'react';
import { Loader2, FileText, Check, X, Calendar, MapPin, Star, Flame, Sparkles, Ban, Eye, ExternalLink } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { inputCls } from '../../components/FormField';
import SeatmapPreview from '../../features/seatmap/SeatmapPreview';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/v1';
const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;
const fmt = (d) => (d ? new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—');
const TABS = [
  { k: 'PENDING', t: 'Chờ duyệt' },
  { k: 'APPROVED', t: 'Chờ ký hợp đồng' },
  { k: 'PUBLISHED', t: 'Đang mở bán' },
  { k: 'CANCELLED', t: 'Đã huỷ' },
  { k: 'CONTRACTS', t: 'Hợp đồng' },
];
const label = 'block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5';
const CONTRACT_STATUS = { WAITING_SIGN: 'Chờ ký', SIGNED: 'Đã ký', REJECTED: 'Đã từ chối' };

const FIELD_TYPE = { text: 'Văn bản', textarea: 'Đoạn văn', select: 'Chọn một', checkbox: 'Hộp kiểm', number: 'Số' };

/** Chi tiết đầy đủ để Admin duyệt: không phải mở trang công khai (sự kiện chưa duyệt không hiện công khai). */
function EventDetail({ d, onClose }) {
  const clean = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return (
    <div className='space-y-5'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h2 className='text-lg font-bold'>{d.title}</h2>
          <p className='text-xs text-[#71717a] mt-0.5'>
            {d.categoryName || '—'} · {d.venueName}, {d.city} · {fmt(d.startTime)} – {fmt(d.endTime)}
          </p>
        </div>
        <button type='button' onClick={onClose} className='text-[#71717a] hover:text-[#09090b]' aria-label='Đóng'>
          <X size={18} />
        </button>
      </div>

      {d.bannerUrl && <img src={d.bannerUrl} alt='' className='w-full max-h-56 object-cover rounded-xl bg-[#f4f4f6]' />}

      <section className='space-y-1'>
        <h3 className={label}>Nhà tổ chức</h3>
        <p className='text-sm'>
          {d.organizer?.organizationName || d.organizer?.name} ({d.organizer?.businessType === 'ENTERPRISE' ? 'Doanh nghiệp' : 'Cá nhân'}) · MST {d.organizer?.taxCode || '—'}
        </p>
        <p className='text-xs text-[#71717a]'>{d.organizer?.email} {d.organizer?.phone && `· ${d.organizer.phone}`}</p>
      </section>

      <section className='space-y-1'>
        <h3 className={label}>Mô tả</h3>
        <p className='text-sm text-[#27272a] whitespace-pre-wrap max-h-40 overflow-y-auto'>{clean(d.description) || '—'}</p>
      </section>

      <section className='space-y-2'>
        <h3 className={label}>Suất diễn & hạng vé</h3>
        {d.sessions.map((s) => (
          <div key={s._id} className='border border-[#e4e4e7] rounded-xl p-3'>
            <div className='text-sm font-semibold'>{s.name} · <span className='font-normal text-[#52525b]'>{fmt(s.startTime)} – {fmt(s.endTime)}</span></div>
            <ul className='mt-1.5 text-xs text-[#52525b] grid gap-1 sm:grid-cols-2'>
              {s.tiers.map((t) => (
                <li key={t._id}>
                  <strong>{t.name}</strong> · {money(t.price)} · {t.totalQuantity} vé · {t.zoneType === 'SEATED' ? 'ghế đánh số' : 'vé đứng'} · {t.minPerOrder}–{t.maxPerOrder} vé/đơn
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className='space-y-1'>
        <h3 className={label}>Sơ đồ chỗ ngồi</h3>
        {d.seatmap?.exists ? (
          <ul className='text-xs text-[#52525b] grid gap-1 sm:grid-cols-2'>
            {d.seatmap.sections.map((s) => (
              <li key={s.name}>
                <strong>{s.name}</strong> · {s.type === 'GA' ? 'chỗ đứng' : 'ghế'} · {s.capacity} · hạng {s.tierName}
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-xs text-[#71717a]'>Chưa có sơ đồ (khách chọn hạng vé và số lượng).</p>
        )}
      </section>

      <section className='space-y-1'>
        <h3 className={label}>Cấu hình khác</h3>
        <p className='text-xs text-[#52525b]'>
          Bán lại vé: {d.allowResale ? `cho phép, tối đa +${d.maxResaleMarkupPct}%` : 'không'} · Giấy phép: {d.hasLegalDoc ? 'đã nộp' : 'chưa nộp'}
        </p>
        {d.customFormSchema?.length > 0 && (
          <ul className='text-xs text-[#52525b] list-disc pl-5'>
            {d.customFormSchema.map((f) => (
              <li key={f.key}>{f.label} ({FIELD_TYPE[f.type] || f.type}{f.required ? ', bắt buộc' : ''})</li>
            ))}
          </ul>
        )}
      </section>

      {d.contract?.rejectionReason && (
        <p className='text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2'>
          Nhà tổ chức từ chối ký (hoa hồng đề xuất {d.contract.commissionRatePct}%): {d.contract.rejectionReason}
        </p>
      )}

      {d.statusHistory?.length > 0 && (
        <section className='space-y-1'>
          <h3 className={label}>Lịch sử trạng thái</h3>
          <ul className='text-xs text-[#52525b] space-y-0.5'>
            {[...d.statusHistory].reverse().map((h, i) => (
              <li key={i}>
                {fmt(h.at)} · <strong>{h.status}</strong>{h.note ? ` · ${h.note}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className='flex flex-wrap gap-3'>
        <a className='tb-btn tb-btn-outline tb-btn-sm' href={`/events/${d._id}`} target='_blank' rel='noopener noreferrer'>
          <ExternalLink size={13} /> Xem trước trang công khai
        </a>
        <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={onClose}>Đóng</button>
      </div>
    </div>
  );
}

/** UC39, UC40, UC41, UC43, UC24: duyệt sự kiện + hoa hồng, hợp đồng, nổi bật trang chủ, dựng sơ đồ ghế, hoàn tiền khi huỷ. */
export default function AdminEventsPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState('PENDING');
  const [items, setItems] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [dlg, setDlg] = useState(null); // { type: approve|reject|refund|commission|seatmap, target }
  const [form, setForm] = useState({ rate: '', terms: '', reason: '' });
  const [detail, setDetail] = useState(null); // { loading, data } panel chi tiết khi duyệt

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'CONTRACTS') {
        const r = await api.get('/admin/contracts');
        setContracts(r.contracts || r.items || []);
      } else {
        const r = await api.get(`/admin/events?status=${tab}&limit=50`);
        setItems(r.items || []);
      }
    } catch (err) {
      showToast(err.message || 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [tab, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const close = () => {
    setDlg(null);
  };
  const openDlg = (type, target) => {
    setForm({ rate: target.lastCommissionRatePct ?? target.defaultCommissionPct ?? target.commissionRatePct ?? '10', terms: '', reason: '' });
    setDlg({ type, target });
  };

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try {
      const r = await fn();
      showToast(okMsg ? okMsg(r) : 'Thành công');
      close();
      await load();
    } catch (err) {
      showToast(err.message || 'Không thực hiện được');
    } finally {
      setBusy('');
    }
  };

  const openDetail = async (e) => {
    setDetail({ loading: true, data: null });
    try {
      const r = await api.get(`/admin/events/${e._id}`);
      setDetail({ loading: false, data: r.event });
    } catch (err) {
      setDetail(null);
      showToast(err.message || 'Không tải được chi tiết sự kiện');
    }
  };

  const openLegal = async (e) => {
    try {
      const r = await api.get(`/admin/events/${e._id}/legal-doc`);
      window.open(r.url || `${BASE}/admin/events/${e._id}/legal-doc`, '_blank', 'noopener');
    } catch (err) {
      showToast(err.message || 'Không mở được giấy phép');
    }
  };

  const approve = () => {
    const rate = Number(form.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 50) return showToast('Hoa hồng phải từ 0 đến 50 (%)');
    run('approve', () => api.put(`/admin/events/${dlg.target._id}/approve`, { commissionRatePct: rate, ...(form.terms.trim() ? { customTerms: form.terms.trim() } : {}) }), (r) => r.message || 'Đã duyệt sự kiện');
  };
  const reject = () => {
    if (!form.reason.trim()) return showToast('Vui lòng nhập lý do từ chối');
    run('reject', () => api.put(`/admin/events/${dlg.target._id}/reject`, { reason: form.reason.trim() }), () => 'Đã từ chối, sự kiện trở về bản nháp');
  };
  const refund = () => {
    if (!form.reason.trim()) return showToast('Vui lòng nhập lý do huỷ');
    run('refund', () => api.post(`/admin/events/${dlg.target._id}/bulk-refund`, { reason: form.reason.trim() }), (r) => `${r.message}. Hoàn ${money(r.totalRefundAmount)}, đã email ${r.notifiedBuyersCount} khách`);
  };
  const commission = () => {
    const rate = Number(form.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 50) return showToast('Hoa hồng phải từ 0 đến 50 (%)');
    run('commission', () => api.put(`/admin/contracts/${dlg.target.id}/commission`, { commissionRatePct: rate }), () => 'Đã cập nhật hoa hồng');
  };
  const feature = (e, patch) => run(`f:${e._id}`, () => api.put(`/admin/events/${e._id}/featured`, patch), () => 'Đã cập nhật trang chủ');

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Sự kiện & hợp đồng</h1>
        <p className='text-sm text-[#71717a] mt-1'>Duyệt nội dung, đặt hoa hồng, theo dõi hợp đồng và xử lý huỷ sự kiện.</p>
      </div>

      <div className='flex flex-wrap gap-2'>
        {TABS.map(({ k, t }) => (
          <button key={k} type='button' onClick={() => setTab(k)} className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${tab === k ? 'bg-[#09090b] text-white border-[#09090b]' : 'bg-white border-[#e4e4e7] text-[#52525b] hover:border-[#09090b]'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className='text-[#71717a] flex items-center gap-2'>
          <Loader2 size={16} className='animate-spin' /> Đang tải...
        </div>
      ) : tab === 'CONTRACTS' ? (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left text-[11px] uppercase tracking-wider text-[#71717a] border-b border-[#e4e4e7]'>
                <th className='p-4'>Số hợp đồng</th>
                <th>Sự kiện</th>
                <th>Hoa hồng</th>
                <th>Trạng thái</th>
                <th>Ký lúc</th>
                <th className='text-right pr-4'>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={6} className='p-8 text-center text-[#71717a]'>Chưa có hợp đồng.</td>
                </tr>
              )}
              {contracts.map((c) => (
                <tr key={c.id} className='border-b border-[#f4f4f6] last:border-0'>
                  <td className='p-4 font-mono text-xs'>{c.contractNumber}</td>
                  <td className='font-semibold'>{c.eventTitle || '—'}</td>
                  <td>{c.commissionRatePct}%</td>
                  <td>{CONTRACT_STATUS[c.status] || c.status}</td>
                  <td className='text-xs text-[#52525b]'>{fmt(c.signedAt)}</td>
                  <td className='text-right pr-4 space-x-2'>
                    {c.status === 'WAITING_SIGN' && (
                      <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => openDlg('commission', c)}>
                        Sửa hoa hồng
                      </button>
                    )}
                    {c.status === 'SIGNED' && (
                      <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => window.open(`${BASE}/admin/contracts/${c.id}/pdf`, '_blank', 'noopener')}>
                        Tải PDF
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : items.length === 0 ? (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl p-12 text-center text-sm text-[#71717a]'>Không có sự kiện nào.</div>
      ) : (
        <div className='grid gap-4'>
          {items.map((e) => (
            <div key={e._id} className='bg-white border border-[#e4e4e7] rounded-2xl p-4 flex flex-col sm:flex-row gap-4'>
              <img src={e.bannerUrl} alt='' className='w-full sm:w-40 h-28 rounded-xl object-cover bg-[#f4f4f6] shrink-0' onError={(ev) => { ev.currentTarget.src = '/assets/banners/hero_0.jpg'; }} />
              <div className='flex-1 min-w-0 space-y-2'>
                <h2 className='font-bold'>{e.title}</h2>
                <div className='text-xs text-[#52525b] flex flex-wrap gap-x-4 gap-y-1'>
                  <span className='flex items-center gap-1.5'><Calendar size={12} /> {fmt(e.startTime)}</span>
                  <span className='flex items-center gap-1.5'><MapPin size={12} /> {e.venueName}, {e.city}</span>
                  {e.categoryName && <span>Danh mục: {e.categoryName}</span>}
                  <span>Từ {money(e.lowestPrice)}</span>
                </div>
                <div className='text-xs text-[#71717a]'>Nhà tổ chức: {e.organizerName || '—'} {e.organizerEmail && `(${e.organizerEmail})`}</div>
                {e.rejectionReason && <p className='text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2'>{tab === 'PENDING' && e.contractRejectionReason ? 'Nhà tổ chức không đồng ý hợp đồng' : 'Đã từ chối'}: {e.rejectionReason}{e.lastCommissionRatePct != null && tab === 'PENDING' ? ` (hoa hồng đã đề xuất: ${e.lastCommissionRatePct}%)` : ''}</p>}

                <div className='flex flex-wrap gap-2 pt-1'>
                  <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => openDetail(e)}>
                    <Eye size={13} /> Xem chi tiết
                  </button>
                  <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' disabled={!e.hasLegalDoc} onClick={() => openLegal(e)} title={e.hasLegalDoc ? '' : 'Nhà tổ chức chưa nộp giấy phép'}>
                    <FileText size={13} /> Giấy phép
                  </button>
                  {tab === 'PENDING' && (
                    <>
                      <button type='button' className='tb-btn tb-btn-solid tb-btn-sm' onClick={() => openDlg('approve', e)}>
                        <Check size={13} /> Duyệt
                      </button>
                      <button type='button' className='tb-btn tb-btn-outline tb-btn-sm text-red-700' onClick={() => openDlg('reject', e)}>
                        <X size={13} /> Từ chối
                      </button>
                    </>
                  )}
                  {['PENDING', 'APPROVED', 'PUBLISHED'].includes(tab) && (
                    <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => openDlg('seatmap', e)}>
                      <Eye size={13} /> Sơ đồ ghế
                    </button>
                  )}
                  {tab === 'PUBLISHED' && (
                    <>
                      <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => feature(e, { isFeaturedBanner: true })} title='Đưa lên banner trang chủ'>
                        <Star size={13} /> Banner
                      </button>
                      <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => feature(e, { isTrending: true })}>
                        <Flame size={13} /> Xu hướng
                      </button>
                      <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => feature(e, { isSpecial: true })}>
                        <Sparkles size={13} /> Duy nhất
                      </button>
                    </>
                  )}
                  {['APPROVED', 'PUBLISHED'].includes(tab) && (
                    <button type='button' className='tb-btn tb-btn-outline tb-btn-sm text-red-700' onClick={() => openDlg('refund', e)}>
                      <Ban size={13} /> Huỷ & hoàn tiền
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50' onClick={() => setDetail(null)}>
          <div className='bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 space-y-5' onClick={(e) => e.stopPropagation()}>
            {detail.loading || !detail.data ? (
              <div className='text-[#71717a] flex items-center gap-2'>
                <Loader2 size={16} className='animate-spin' /> Đang tải...
              </div>
            ) : (
              <EventDetail d={detail.data} onClose={() => setDetail(null)} />
            )}
          </div>
        </div>
      )}

      {dlg && (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50' onClick={close}>
          <div className='bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 space-y-4' onClick={(e) => e.stopPropagation()}>
            <h3 className='font-bold'>
              {{ approve: 'Duyệt sự kiện', reject: 'Từ chối sự kiện', refund: 'Huỷ sự kiện & hoàn tiền hàng loạt', commission: 'Sửa hoa hồng hợp đồng', seatmap: 'Sơ đồ chỗ ngồi nhà tổ chức đã tải' }[dlg.type]}
              <span className='block text-sm font-normal text-[#71717a] mt-0.5'>{dlg.target.title || dlg.target.eventTitle}</span>
            </h3>

            {(dlg.type === 'approve' || dlg.type === 'commission') && (
              <div>
                <label htmlFor='ad-rate' className={label}>Hoa hồng nền tảng (%) — từ 0 đến 50</label>
                <input id='ad-rate' type='number' min='0' max='50' step='0.5' className={inputCls} value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
              </div>
            )}
            {dlg.type === 'approve' && (
              <div>
                <label htmlFor='ad-terms' className={label}>Điều khoản bổ sung (tùy chọn)</label>
                <textarea id='ad-terms' rows={3} className={inputCls} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} maxLength={5000} />
                <p className='text-xs text-[#71717a] mt-1.5'>Duyệt xong hệ thống tự tạo hợp đồng chờ nhà tổ chức ký, ký xong sự kiện mới mở bán.</p>
              </div>
            )}
            {(dlg.type === 'reject' || dlg.type === 'refund') && (
              <div>
                <label htmlFor='ad-reason' className={label}>{dlg.type === 'reject' ? 'Lý do từ chối (nhà tổ chức sẽ thấy)' : 'Lý do huỷ (gửi email cho khách đã mua vé)'}</label>
                <textarea id='ad-reason' rows={4} className={inputCls} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={1000} />
                {dlg.type === 'refund' && <p className='text-xs text-red-700 mt-1.5'>Không thể hoàn tác: sự kiện và mọi suất diễn bị huỷ, mọi đơn đã thanh toán chuyển sang hoàn tiền, khách nhận email. Tiền do Admin chuyển khoản thủ công.</p>}
              </div>
            )}

            {dlg.type === 'seatmap' && <SeatmapPreview eventId={dlg.target._id} scope='admin' />}

            <div className='flex flex-wrap gap-3 pt-1'>
              {dlg.type === 'seatmap' ? null : (
                <button
                  type='button'
                  className='tb-btn tb-btn-solid'
                  disabled={Boolean(busy)}
                  onClick={{ approve, reject, refund, commission }[dlg.type]}>
                  {busy ? 'Đang xử lý...' : 'Xác nhận'}
                </button>
              )}
              <button type='button' className='tb-btn tb-btn-outline' onClick={close}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
