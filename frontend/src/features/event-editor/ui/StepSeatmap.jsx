import SeatmapBuilder from '../../seatmap/SeatmapBuilder';
import { useEventEditorStore } from '../model/useEventEditorStore';

export default function StepSeatmap({ eventId }) {
  const { editing, status } = useEventEditorStore();
  const canEdit = ['DRAFT', 'PENDING', 'APPROVED', 'PUBLISHED'].includes(status);

  return (
    <div className='space-y-4'>
      <h2 className='font-bold'>Sơ đồ chỗ ngồi / chỗ đứng</h2>
      {editing ? (
        <SeatmapBuilder eventId={eventId} canEdit={canEdit} />
      ) : (
        <div className='text-sm text-[#52525b] space-y-2'>
          <p>
            Sơ đồ được dựng sau khi sự kiện được lưu (cần mã sự kiện). Hãy bấm <strong>Lưu bản nháp</strong> ở bước cuối: hệ thống sẽ tự chuyển bạn về bước này để tải file SVG + Excel.
          </p>
          <p className='text-xs text-[#71717a]'>
            Nếu không cần sơ đồ, bỏ qua bước này: khách sẽ chọn hạng vé và số lượng.
          </p>
        </div>
      )}
    </div>
  );
}
