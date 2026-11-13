import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, Plus, Trash2, Wallet, Users, ReceiptText, BarChart3, ScanLine, History, CheckCircle2, X } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { inputCls } from '../../components/FormField';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/v1';
const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;
const fmt = (d) => (d ? new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—');
const TABS = [
  { k: 'overview', t: 'Tổng quan', i: BarChart3 },
  { k: 'orders', t: 'Đơn hàng', i: ReceiptText },
  { k: 'attendees', t: 'Người tham dự', i: Users },
  { k: 'staff', t: 'Nhân viên soát vé', i: ScanLine },
  { k: 'payout', t: 'Đối soát', i: Wallet },
  { k: 'history', t: 'Lịch sử', i: History },
];
const EVENT_STATUS = {
  DRAFT: 'Bản nháp',
  PENDING: 'Chờ Admin duyệt',
  APPROVED: 'Đã duyệt, chờ ký hợp đồng',
  PUBLISHED: 'Đang mở bán',
  CANCELLED: 'Đã huỷ',
  ENDED: 'Đã kết thúc',
};
const PAYOUT_STATUS = {
  REQUESTED: 'Chờ Admin duyệt',
  APPROVED: 'Đã duyệt, chờ chuyển khoản',
  SETTLED: 'Đã giải ngân',
  REJECTED: 'Bị từ chối',
};
const ORDER_STATUS = {
  PAID: 'Đã thanh toán',
  PENDING_PAYMENT: 'Chờ thanh toán',
  EXPIRED: 'Hết hạn',
  CANCELLED: 'Đã huỷ',
  REFUNDED: 'Đã hoàn tiền',
};
const TICKET_STATUS = {
  VALID: 'Hợp lệ',
  USED: 'Đã soát',
  LISTED_RESALE: 'Đang bán lại',
  RESOLD_INVALID: 'Đã sang nhượng',
  REFUNDED: 'Đã hoàn tiền',
};

function Stat({ label, value, sub }) {
  return (
    <div className='bg-white border border-[#e4e4e7] rounded-2xl p-5'>
      <div className='text-[11px] uppercase tracking-wider font-semibold text-[#71717a]'>{label}</div>
      <div className='text-2xl font-extrabold tracking-tight mt-1'>{value}</div>
      {sub && <div className='text-xs text-[#71717a] mt-1'>{sub}</div>}
    </div>
  );
}

function Answers({ a }) {
  const entries = a && !Array.isArray(a) ? Object.entries(a) : [];
  if (!entries.length) return <span className='text-[#a1a1aa]'>—</span>;
  return (
    <div className='space-y-0.5'>
      {entries.map(([k, v]) => (
        <div key={k} className='text-xs'>
          <span className='text-[#71717a]'>{k}:</span> {typeof v === 'boolean' ? (v ? 'Có' : 'Không') : String(v)}
        </div>
      ))}
    </div>
  );
}

/** Quản lý một sự kiện: thống kê (UC31, UC32), đơn hàng + người tham dự (UC29), nhân viên (UC30), xuất CSV (UC33), đối soát (UC34). */
export default function OrganizerEventDashboardPage() {
  const { id } = useParams();
  const { showToast } = useToast();
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});
  const [search, setSearch] = useState('');
  const [staffForm, setStaffForm] = useState({ email: '', assignedGate: 'Cổng chính' });
  const [busy, setBusy] = useState(false);
  const [payoutConfirm, setPayoutConfirm] = useState(false);
  const [payoutSuccess, setPayoutSuccess] = useState(null);

  const load = useCallback(
    async (which) => {
      setLoading(true);
      try {
        const q = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
        const urls = {
          overview: [`/organizer/events/${id}/analytics`],
          orders: [`/organizer/events/${id}/orders${q}`],
          attendees: [`/organizer/events/${id}/attendees${q}`],
          staff: [`/organizer/events/${id}/staff`],
          payout: [`/organizer/events/${id}/payout-summary`],
          history: [`/organizer/events/${id}/history`],
        }[which];
        const r = await api.get(urls[0]);
        setData((p) => ({ ...p, [which]: r }));
      } catch (err) {
        showToast(err.message || 'Không tải được dữ liệu');
      } finally {
        setLoading(false);
      }
    },
    [id, search, showToast],
  );

  useEffect(() => {
    load(tab);
    // tìm kiếm chỉ chạy khi bấm nút, không chạy theo từng ký tự
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id]);

  const exportCsv = (kind) => window.open(`${BASE}/organizer/events/${id}/export/${kind}`, '_blank', 'noopener');

  const addStaff = async (e) => {
    e.preventDefault();
    if (!staffForm.email.trim())
      return showToast('Nhập email của nhân viên (tài khoản đã đăng nhập hệ thống ít nhất một lần)');
    setBusy(true);
    try {
      const r = await api.post(`/organizer/events/${id}/staff`, {
        email: staffForm.email.trim(),
        assignedGate: staffForm.assignedGate.trim() || 'Cổng chính',
      });
      showToast(r.message || 'Đã thêm nhân viên');
      setStaffForm({ ...staffForm, email: '' });
      load('staff');
    } catch (err) {
      showToast(err.message || 'Không thêm được nhân viên');
    } finally {
      setBusy(false);
    }
  };

  const removeStaff = async (a) => {
    if (!window.confirm(`Gỡ ${a.staffUser.name} khỏi sự kiện?`)) return;
    try {
      await api.delete(`/organizer/staff-assignments/${a.assignmentId}`);
      showToast('Đã gỡ nhân viên');
      load('staff');
    } catch (err) {
      showToast(err.message || 'Không gỡ được');
    }
  };

  const requestPayout = () => setPayoutConfirm(true);

  const submitPayout = async () => {
    setPayoutConfirm(false);
    setBusy(true);
    try {
      const r = await api.post(`/organizer/events/${id}/payout/request`, {});
      setPayoutSuccess({
        message: r.message || 'Đã gửi yêu cầu đối soát và rút tiền thành công!',
        amount: ps?.netPayoutAmount,
      });
      load('payout');
    } catch (err) {
      showToast(err.message || 'Không gửi được yêu cầu');
    } finally {
      setBusy(false);
    }
  };

  const an = data.overview?.analytics;
  const ps = data.payout?.payoutSummary || data.payout?.summary;
  const searchBox = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        load(tab);
      }}
      className='flex gap-2'>
      <input
        className={`${inputCls} max-w-xs`}
        placeholder='Tìm theo mã, tên, email...'
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <button type='submit' className='tb-btn tb-btn-outline tb-btn-sm'>
        Tìm
      </button>
    </form>
  );

  return (
    <div className='space-y-6'>
      <div>
        <Link
          to='/organizer/events'
          className='text-xs font-semibold text-[#71717a] hover:text-[#09090b] inline-flex items-center gap-1.5'>
          <ArrowLeft size={13} /> Về danh sách sự kiện
        </Link>
        <h1 className='text-2xl font-bold tracking-tight mt-2'>{an?.title || 'Quản lý sự kiện'}</h1>
      </div>

      <div className='flex flex-wrap gap-2'>
        {TABS.map(({ k, t, i: Icon }) => (
          <button
            key={k}
            type='button'
            onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
              tab === k
                ? 'bg-[#09090b] text-white border-[#09090b]'
                : 'bg-white border-[#e4e4e7] text-[#52525b] hover:border-[#09090b]'
            }`}>
            <Icon size={13} /> {t}
          </button>
        ))}
      </div>

      {loading && !data[tab] && (
        <div className='text-[#71717a] flex items-center gap-2'>
          <Loader2 size={16} className='animate-spin' /> Đang tải...
        </div>
      )}

      {tab === 'overview' && an && (
        <div className='space-y-6'>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <Stat label='Doanh thu gộp' value={money(an.grossRevenue)} sub={`Giảm giá: ${money(an.totalDiscount)}`} />
            <Stat
              label='Thực nhận'
              value={money(an.netEarnings)}
              sub={`Hoa hồng ${an.commissionRatePct}%: ${money(an.platformCommissionAmt)}`}
            />
            <Stat label='Vé đã bán' value={an.totalTicketsSold} />
            <Stat label='Đã soát vé' value={an.checkedInCount} sub={`${an.checkInRatePct}% tổng vé`} />
          </div>
          <div className='bg-white border border-[#e4e4e7] rounded-2xl overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='text-left text-[11px] uppercase tracking-wider text-[#71717a] border-b border-[#e4e4e7]'>
                  <th className='p-4'>Hạng vé</th>
                  <th>Giá</th>
                  <th>Đã bán</th>
                  <th>Tổng</th>
                  <th className='text-right pr-4'>Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {(an.tierAnalytics || []).map((t) => (
                  <tr key={t.tierId} className='border-b border-[#f4f4f6] last:border-0'>
                    <td className='p-4 font-semibold'>{t.tierName}</td>
                    <td>{money(t.price)}</td>
                    <td>{t.soldQuantity ?? 0}</td>
                    <td>{t.totalQuantity ?? '—'}</td>
                    <td className='text-right pr-4'>{money(t.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className='flex flex-wrap gap-3'>
            <button type='button' className='tb-btn tb-btn-outline' onClick={() => exportCsv('orders')}>
              <Download size={14} /> Xuất đơn hàng (CSV)
            </button>
            <button type='button' className='tb-btn tb-btn-outline' onClick={() => exportCsv('attendees')}>
              <Download size={14} /> Xuất người tham dự (CSV)
            </button>
          </div>
        </div>
      )}

      {tab === 'orders' && data.orders && (
        <div className='space-y-4'>
          {searchBox}
          <div className='bg-white border border-[#e4e4e7] rounded-2xl overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='text-left text-[11px] uppercase tracking-wider text-[#71717a] border-b border-[#e4e4e7]'>
                  <th className='p-4'>Mã đơn</th>
                  <th>Người mua</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái</th>
                  <th>Câu trả lời form</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className='p-8 text-center text-[#71717a]'>
                      Chưa có đơn hàng.
                    </td>
                  </tr>
                )}
                {data.orders.orders.map((o) => (
                  <tr key={o.id} className='border-b border-[#f4f4f6] last:border-0 align-top'>
                    <td className='p-4 font-mono text-xs'>{o.orderCode}</td>
                    <td>
                      <div className='font-semibold'>{o.buyer.name}</div>
                      <div className='text-xs text-[#71717a]'>{o.buyer.email}</div>
                    </td>
                    <td>{money(o.totalAmount)}</td>
                    <td>{ORDER_STATUS[o.status] || o.status}</td>
                    <td>
                      <Answers a={o.attendeeFormAnswers} />
                    </td>
                    <td className='text-xs text-[#52525b]'>{fmt(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'attendees' && data.attendees && (
        <div className='space-y-4'>
          {searchBox}
          <div className='bg-white border border-[#e4e4e7] rounded-2xl overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='text-left text-[11px] uppercase tracking-wider text-[#71717a] border-b border-[#e4e4e7]'>
                  <th className='p-4'>Mã vé</th>
                  <th>Người sở hữu</th>
                  <th>Hạng vé / Ghế</th>
                  <th>Trạng thái</th>
                  <th>Câu trả lời form</th>
                  <th>Soát lúc</th>
                </tr>
              </thead>
              <tbody>
                {data.attendees.attendees.length === 0 && (
                  <tr>
                    <td colSpan={6} className='p-8 text-center text-[#71717a]'>
                      Chưa có người tham dự.
                    </td>
                  </tr>
                )}
                {data.attendees.attendees.map((a) => (
                  <tr key={a.ticketId} className='border-b border-[#f4f4f6] last:border-0 align-top'>
                    <td className='p-4 font-mono text-xs'>{a.ticketCode}</td>
                    <td>
                      <div className='font-semibold'>{a.owner.name}</div>
                      <div className='text-xs text-[#71717a]'>{a.owner.email}</div>
                    </td>
                    <td>
                      {a.tierName} <span className='text-[#71717a]'>· {a.seat}</span>
                    </td>
                    <td>{TICKET_STATUS[a.status] || a.status}</td>
                    <td>
                      <Answers a={a.attendeeFormAnswers} />
                    </td>
                    <td className='text-xs text-[#52525b]'>{fmt(a.checkedInAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className='text-xs text-[#71717a]'>
            Tổng {data.attendees.total} vé. Dùng nút xuất CSV ở tab Tổng quan để lấy toàn bộ.
          </p>
        </div>
      )}

      {tab === 'staff' && data.staff && (
        <div className='space-y-4'>
          <form
            onSubmit={addStaff}
            className='bg-white border border-[#e4e4e7] rounded-2xl p-5 grid gap-3 sm:grid-cols-[2fr_1fr_auto] items-end'>
            <div>
              <label
                htmlFor='st-email'
                className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
                Email nhân viên
              </label>
              <input
                id='st-email'
                type='email'
                className={inputCls}
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                placeholder='nhanvien@gmail.com'
              />
            </div>
            <div>
              <label
                htmlFor='st-gate'
                className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
                Cổng
              </label>
              <input
                id='st-gate'
                className={inputCls}
                value={staffForm.assignedGate}
                onChange={(e) => setStaffForm({ ...staffForm, assignedGate: e.target.value })}
              />
            </div>
            <button type='submit' disabled={busy} className='tb-btn tb-btn-solid'>
              <Plus size={14} /> Thêm
            </button>
          </form>
          <div className='bg-white border border-[#e4e4e7] rounded-2xl divide-y divide-[#f4f4f6]'>
            {data.staff.staff.length === 0 && (
              <div className='p-8 text-center text-sm text-[#71717a]'>Chưa phân công nhân viên nào.</div>
            )}
            {data.staff.staff.map((a) => (
              <div key={a.assignmentId} className='p-4 flex items-center justify-between gap-3'>
                <div>
                  <div className='font-semibold text-sm'>{a.staffUser.name}</div>
                  <div className='text-xs text-[#71717a]'>
                    {a.staffUser.email} · {a.assignedGate} {!a.isActive && '· (đã gỡ)'}
                  </div>
                </div>
                {a.isActive && (
                  <button
                    type='button'
                    aria-label='Gỡ nhân viên'
                    className='text-red-700'
                    onClick={() => removeStaff(a)}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className='text-xs text-[#71717a]'>
            Người được thêm sẽ trở thành nhân viên soát vé và dùng trang Soát vé QR.
          </p>
        </div>
      )}

      {tab === 'history' && data.history && (
        <div className='max-w-2xl space-y-3'>
          <p className='text-sm text-[#52525b]'>
            Trạng thái hiện tại: <strong>{EVENT_STATUS[data.history.status] || data.history.status}</strong>
          </p>
          <ol className='border-l-2 border-[#e4e4e7] pl-5 space-y-4'>
            {data.history.history.map((h, i) => (
              <li key={i} className='relative'>
                <span className='absolute -left-6.75 top-1.5 w-3 h-3 rounded-full bg-[#09090b]' />
                <div className='text-sm font-semibold'>{EVENT_STATUS[h.status] || h.status}</div>
                <div className='text-xs text-[#71717a]'>{fmt(h.at)}</div>
                {h.note && <div className='text-xs text-[#52525b] mt-0.5'>{h.note}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {tab === 'payout' && ps && (
        <div className='space-y-4 max-w-2xl'>
          <div className='grid gap-4 sm:grid-cols-3'>
            <Stat label='Doanh thu gộp' value={money(ps.grossRevenue)} />
            <Stat label={`Hoa hồng ${ps.commissionRatePct}%`} value={money(ps.platformCommissionAmt)} />
            <Stat label='Thực nhận' value={money(ps.netPayoutAmount)} />
          </div>
          {ps.existingSettlement && (
            <div
              className={`p-4 border rounded-xl text-sm ${ps.existingSettlement.status === 'REJECTED' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-[#f9f9fb] border-[#e4e4e7]'}`}>
              Yêu cầu đối soát:{' '}
              <strong>{PAYOUT_STATUS[ps.existingSettlement.status] || ps.existingSettlement.status}</strong> ·{' '}
              {money(ps.existingSettlement.netPayoutAmount)}
              {ps.existingSettlement.settledAt && ` · giải ngân ${fmt(ps.existingSettlement.settledAt)}`}
              {ps.existingSettlement.status === 'REJECTED' && ps.existingSettlement.rejectionReason && (
                <div className='mt-1'>Lý do: {ps.existingSettlement.rejectionReason}</div>
              )}
            </div>
          )}
          {!ps.existingSettlement || ps.existingSettlement.status === 'REJECTED' ? (
            <button
              type='button'
              disabled={busy || !ps.grossRevenue}
              className='tb-btn tb-btn-solid'
              onClick={requestPayout}>
              <Wallet size={14} />{' '}
              {busy
                ? 'Đang gửi...'
                : ps.existingSettlement
                  ? 'Gửi lại yêu cầu đối soát'
                  : 'Yêu cầu đối soát & rút tiền'}
            </button>
          ) : null}
          <p className='text-xs text-[#71717a]'>
            Tiền được chuyển vào tài khoản ngân hàng trong hồ sơ KYC sau khi Admin duyệt đối soát.
          </p>
        </div>
      )}
      {payoutConfirm && (
        <div className='fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4' onClick={() => setPayoutConfirm(false)}>
          <div className='relative bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl' onClick={(e) => e.stopPropagation()}>
            <button type='button' onClick={() => setPayoutConfirm(false)} className='absolute top-4 right-4 text-[#71717a] hover:text-[#09090b]' aria-label='Đóng'>
              <X size={18} />
            </button>
            <Wallet size={40} className='mx-auto text-[#09090b]' />
            <h2 className='text-xl font-bold text-center'>Xác nhận yêu cầu đối soát</h2>
            <p className='text-sm text-center text-[#52525b]'>Bạn có chắc muốn gửi yêu cầu đối soát và rút tiền cho sự kiện này?</p>
            <div className='flex gap-3'>
              <button type='button' className='tb-btn w-full' onClick={() => setPayoutConfirm(false)}>Hủy</button>
              <button type='button' className='tb-btn tb-btn-solid w-full' onClick={submitPayout}>Xác nhận gửi</button>
            </div>
          </div>
        </div>
      )}
      {payoutSuccess && (
        <div className='fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4' onClick={() => setPayoutSuccess(null)}>
          <div className='relative bg-white rounded-2xl p-6 w-full max-w-md text-center space-y-4 shadow-xl' onClick={(e) => e.stopPropagation()}>
            <button type='button' onClick={() => setPayoutSuccess(null)} className='absolute top-4 right-4 text-[#71717a] hover:text-[#09090b]' aria-label='Đóng'>
              <X size={18} />
            </button>
            <CheckCircle2 size={48} className='mx-auto text-emerald-600' />
            <h2 className='text-xl font-bold'>Đã gửi yêu cầu đối soát</h2>
            <p className='text-sm text-[#52525b]'>{payoutSuccess.message}</p>
            <p className='text-lg font-extrabold'>{money(payoutSuccess.amount)}</p>
            <p className='text-xs text-[#71717a]'>Admin sẽ kiểm tra và chuyển khoản vào tài khoản ngân hàng trong hồ sơ KYC của bạn.</p>
            <button type='button' className='tb-btn tb-btn-solid w-full' onClick={() => setPayoutSuccess(null)}>Đã hiểu</button>
          </div>
        </div>
      )}
    </div>
  );
}
