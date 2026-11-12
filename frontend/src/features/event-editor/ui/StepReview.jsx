import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useEventEditorStore } from '../model/useEventEditorStore';

export default function StepReview() {
  const { info, sessions, questions, legalDoc, hasLegalDoc, editing } = useEventEditorStore();

  const preview = useMemo(() => DOMPurify.sanitize(info.description || ''), [info.description]);

  return (
    <div className='space-y-4 text-sm'>
      <div className='grid gap-3 sm:grid-cols-2'>
        {[
          ['Tên sự kiện', info.title],
          ['Địa điểm', `${info.venueName}, ${info.city}`],
          ['Số suất diễn', sessions.length],
          ['Số hạng vé', sessions.reduce((n, s) => n + s.tiers.length, 0)],
          ['Số câu hỏi', questions.length],
          ['Giấy phép', legalDoc ? legalDoc.name : hasLegalDoc ? 'Đã nộp' : 'Chưa có'],
          ['Bán lại vé', info.allowResale ? `Cho phép, tối đa +${info.maxResaleMarkupPct}%` : 'Không'],
        ].map(([k, v]) => (
          <div key={k} className='bg-[#f9f9fb] rounded-lg p-3'>
            <div className='text-[11px] uppercase tracking-wider text-[#71717a]'>{k}</div>
            <div className='font-semibold'>{v || '—'}</div>
          </div>
        ))}
      </div>

      {preview && (
        <div
          className='border border-[#e4e4e7] rounded-lg p-3 max-h-40 overflow-y-auto'
          dangerouslySetInnerHTML={{ __html: preview }}
        />
      )}

      <p className='text-xs text-[#71717a]'>
        {editing
          ? 'Bấm Lưu thay đổi để cập nhật.'
          : 'Lưu nháp để sửa tiếp sau, hoặc Gửi duyệt để Admin xét. Sau khi Admin duyệt, bạn sẽ ký hợp đồng điện tử và sự kiện được mở bán.'}
      </p>
    </div>
  );
}
