import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api } from '../api/client';

const POLL_MS = 30000;
const ago = (d) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
};

/** Chuông thông báo ở thanh trên Dashboard: đếm chưa đọc, tự làm mới 30 giây, bấm vào thông báo thì đánh dấu đã đọc và chuyển trang. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const box = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/user/notifications?limit=20');
      setItems(r.items || []);
      setUnread(r.unreadCount || 0);
    } catch {
      /* thông báo là phụ: lỗi mạng không làm phiền người dùng */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.read) {
      setItems((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      api.put(`/user/notifications/${n.id}/read`, {}).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };

  const readAll = async () => {
    setItems((p) => p.map((x) => ({ ...x, read: true })));
    setUnread(0);
    api.put('/user/notifications/read-all', {}).catch(() => {});
  };

  return (
    <div className='relative' ref={box}>
      <button
        type='button'
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className='relative p-2 text-[#09090b] hover:bg-[#f4f4f6] rounded-full transition-colors'
        title='Thông báo'
        aria-label={`Thông báo${unread ? `, ${unread} chưa đọc` : ''}`}>
        <Bell size={18} />
        {unread > 0 && (
          <span className='absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 rounded-full bg-[#09090b] text-white text-[10px] font-bold flex items-center justify-center'>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className='absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-[#e4e4e7] rounded-2xl shadow-xl z-50 overflow-hidden'>
          <div className='flex items-center justify-between px-4 py-3 border-b border-[#e4e4e7]'>
            <span className='text-sm font-bold'>Thông báo</span>
            {unread > 0 && (
              <button type='button' onClick={readAll} className='text-xs underline text-[#71717a] hover:text-[#09090b]'>
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          <div className='max-h-96 overflow-y-auto'>
            {items.length === 0 ? (
              <div className='p-8 text-center text-xs text-[#71717a]'>Chưa có thông báo nào.</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type='button'
                  onClick={() => openItem(n)}
                  className={`w-full text-left px-4 py-3 border-b border-[#f4f4f6] last:border-0 hover:bg-[#f9f9fb] ${n.read ? '' : 'bg-[#f4f4f6]'}`}>
                  <div className='flex items-start gap-2'>
                    {!n.read && <span className='mt-1.5 w-2 h-2 rounded-full bg-[#09090b] shrink-0' />}
                    <div className='min-w-0'>
                      <div className='text-sm font-semibold leading-snug'>{n.title}</div>
                      {n.body && <div className='text-xs text-[#52525b] mt-0.5 line-clamp-3'>{n.body}</div>}
                      <div className='text-[11px] text-[#a1a1aa] mt-1'>{ago(n.createdAt)}</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
