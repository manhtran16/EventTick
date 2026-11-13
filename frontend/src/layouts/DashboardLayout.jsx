import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Ticket,
  LayoutDashboard,
  Users,
  ShieldCheck,
  CalendarDays,
  FolderTree,
  DollarSign,
  PlusCircle,
  FileCheck2,
  QrCode,
  BarChart3,
  LogOut,
  Home,
  User,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PATHS } from '../routes/paths';
import NotificationBell from '../components/NotificationBell';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      showToast('Đã đăng xuất tài khoản');
      navigate(PATHS.HOME);
    } catch {
      showToast('Đăng xuất thành công');
    }
  };

  const getNavItems = () => {
    switch (user?.role) {
      case 'ADMIN':
        return [
          { label: 'Tổng quan hệ thống', path: PATHS.ADMIN_DASHBOARD, icon: LayoutDashboard },
          { label: 'Quản lý người dùng', path: PATHS.ADMIN_USERS, icon: Users },
          { label: 'Duyệt hồ sơ KYC', path: PATHS.ADMIN_KYC, icon: ShieldCheck },
          { label: 'Duyệt sự kiện & Phí', path: PATHS.ADMIN_EVENTS, icon: CalendarDays },
          { label: 'Danh mục CMS', path: PATHS.ADMIN_CATEGORIES, icon: FolderTree },
          { label: 'Quyết toán Payout', path: PATHS.ADMIN_PAYOUTS, icon: DollarSign },
          { label: 'Chi trả vé Resale', path: PATHS.ADMIN_RESALE_PAYOUTS, icon: Ticket },
        ];
      case 'ORGANIZER':
        return [
          { label: 'Bảng điều khiển', path: PATHS.ORGANIZER_DASHBOARD, icon: LayoutDashboard },
          { label: 'Sự kiện của tôi', path: PATHS.ORGANIZER_EVENTS, icon: CalendarDays },
          { label: 'Tạo sự kiện mới', path: PATHS.ORGANIZER_CREATE_EVENT, icon: PlusCircle },
          { label: 'Xác minh KYC', path: PATHS.ORGANIZER_KYC, icon: ShieldCheck },
          { label: 'Hợp đồng điện tử', path: PATHS.ORGANIZER_CONTRACTS, icon: FileCheck2 },
          { label: 'Doanh thu & Rút tiền', path: PATHS.ORGANIZER_PAYOUTS, icon: DollarSign },
        ];
      case 'STAFF':
        return [
          { label: 'Soát vé QR / Mã code', path: PATHS.STAFF_CHECKIN, icon: QrCode },
          { label: 'Thống kê lượt vào', path: PATHS.STAFF_STATS, icon: BarChart3 },
        ];
      default:
        return [
          { label: 'Vé của tôi', path: PATHS.MY_TICKETS, icon: Ticket },
          { label: 'Hồ sơ cá nhân', path: PATHS.PROFILE, icon: User },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <div className='min-h-screen flex bg-[#f9f9fb] text-[#09090b]'>
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden'
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar N3 */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#09090b] text-white flex flex-col justify-between shrink-0 border-r border-[#27272a] transform transition-transform duration-200 ease-in-out md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className='min-h-0 flex-1 overflow-y-auto'>
          {/* Logo & Role Badge */}
          <div className='p-5 sm:p-6 border-b border-[#27272a] flex items-center justify-between'>
            <Link to={PATHS.HOME} className='flex items-center gap-2.5'>
              <div className='w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-bold'>
                <Ticket size={18} />
              </div>
              <div>
                <div className='font-bold text-base tracking-tight leading-none'>EventTick</div>
                <div className='text-[10px] text-[#a1a1aa] mt-1 font-semibold uppercase tracking-wider'>
                  PORTAL • {user?.role || 'USER'}
                </div>
              </div>
            </Link>
            <button
              type='button'
              onClick={() => setSidebarOpen(false)}
              className='md:hidden p-1 text-[#a1a1aa] hover:text-white'>
              <X size={18} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className='p-3 sm:p-4 space-y-1'>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-black shadow-xs'
                      : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]'
                  }`}>
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom profile & Back */}
        <div className='p-4 border-t border-[#27272a] space-y-2'>
          <Link
            to={PATHS.HOME}
            className='flex items-center gap-2 px-3.5 py-2 text-xs text-[#a1a1aa] hover:text-white hover:bg-[#18181b] rounded-full transition-colors'>
            <Home size={14} />
            <span>Về trang chủ</span>
          </Link>
          <div className='flex items-center justify-between pt-2 px-1'>
            <div className='truncate pr-2'>
              <div className='text-xs font-semibold truncate'>{user?.full_name || user?.name || user?.username}</div>
              <div className='text-[11px] text-[#71717a] truncate'>{user?.email}</div>
            </div>
            <button
              type='button'
              onClick={handleLogout}
              className='p-2 text-[#a1a1aa] hover:text-red-400 hover:bg-[#27272a] rounded-full transition-colors'
              title='Đăng xuất'>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className='flex-1 flex flex-col min-w-0'>
        {/* Top bar */}
        <header className='h-16 bg-white border-b border-[#e4e4e7] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30'>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={() => setSidebarOpen(true)}
              className='md:hidden p-2 text-[#09090b] hover:bg-[#f4f4f6] rounded-full transition-colors'
              title='Mở menu'>
              <Menu size={20} />
            </button>
            <div className='text-xs sm:text-sm font-semibold text-[#09090b] truncate'>
              Hệ thống quản trị • {user?.role}
            </div>
          </div>
          <div className='flex items-center gap-2 sm:gap-3 text-xs text-[#71717a] shrink-0'>
            <Link
              to={PATHS.HOME}
              className='flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium text-[#09090b] hover:bg-[#f4f4f6] border border-[#e4e4e7] transition-colors'
              title='Về trang chủ'>
              <Home size={14} />
              <span className='hidden sm:inline'>Trang chủ</span>
            </Link>

            <NotificationBell />

            <span className='hidden md:inline pl-2 border-l border-[#e4e4e7]'>
              Tài khoản: <strong className='text-[#09090b]'>{user?.full_name || user?.name || user?.username}</strong>
            </span>

            <button
              type='button'
              onClick={handleLogout}
              className='flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-full transition-colors'
              title='Đăng xuất'>
              <LogOut size={14} />
              <span className='hidden sm:inline'>Đăng xuất</span>
            </button>
          </div>
        </header>

        {/* Content body */}
        <main className='flex-1 p-4 sm:p-8 overflow-y-auto'>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
