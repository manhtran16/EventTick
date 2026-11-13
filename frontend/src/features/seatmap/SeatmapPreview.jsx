import { useEffect, useState } from 'react';
import { Loader2, Info } from 'lucide-react';
import { api } from '../../api/client';
import SeatMapView from './SeatMapView';
import { colorSections } from './colors';

/**
 * Xem (chỉ đọc) sơ đồ Organizer đã tải lên cho một sự kiện. Không có sơ đồ thì báo rõ là sự kiện không ghế.
 * scope: 'admin' | 'organizer' (chọn endpoint; backend kiểm quyền sở hữu với organizer).
 */
export default function SeatmapPreview({ eventId, scope = 'organizer' }) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let live = true;
    setState({ loading: true });
    api
      .get(`/${scope}/events/${eventId}/seatmap`)
      .then((r) => live && setState({ data: r }))
      .catch((err) => live && setState({ error: err.message || 'Không tải được sơ đồ' }));
    return () => {
      live = false;
    };
  }, [eventId, scope]);

  if (state.loading)
    return (
      <div className='text-[#71717a] flex items-center gap-2 text-sm'>
        <Loader2 size={14} className='animate-spin' /> Đang tải sơ đồ...
      </div>
    );
  if (state.error) return <p className='text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2'>{state.error}</p>;

  const r = state.data;
  if (!r.hasMap) {
    return (
      <div className='flex items-start gap-2 border border-dashed border-[#d4d4d8] rounded-xl p-4 text-sm text-[#52525b]'>
        <Info size={16} className='mt-0.5 shrink-0' />
        <div>
          <div className='font-semibold'>Sự kiện không có sơ đồ chỗ</div>
          <div className='text-xs text-[#71717a] mt-0.5'>Khách chỉ chọn hạng vé và số lượng, không chọn vị trí.</div>
        </div>
      </div>
    );
  }

  const sections = r.summary?.sections || [];
  const colored = colorSections(sections.map((s) => ({ ...s, status: 'AVAILABLE', available: s.capacity, total: s.capacity, price: 0 })));
  const seated = sections.filter((s) => s.type !== 'GA').reduce((n, s) => n + s.capacity, 0);
  const standing = sections.filter((s) => s.type === 'GA').reduce((n, s) => n + s.capacity, 0);

  return (
    <div className='space-y-3'>
      <p className='text-xs text-[#52525b]'>
        {seated > 0 ? `Sự kiện vé ngồi: ${seated} ghế mỗi suất` : `Sự kiện vé đứng: sức chứa ${standing}`} · {sections.length} khu
      </p>
      <ul className='text-xs text-[#52525b] grid gap-1 sm:grid-cols-2'>
        {sections.map((s) => (
          <li key={s.sectionId}>
            <strong>{s.name}</strong> — {s.type === 'GA' ? `chỗ đứng, sức chứa ${s.capacity}` : `${s.capacity} ghế, ${s.rows} hàng`} · hạng {s.tierName}
          </li>
        ))}
      </ul>
      <SeatMapView svgContent={r.svgContent} sections={colored} seats={r.seats || []} />
    </div>
  );
}
