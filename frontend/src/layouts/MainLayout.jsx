import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  PlusCircle,
  HelpCircle,
  Ticket,
  MapPin,
  ChevronDown,
  Search,
  X,
  User,
  LogOut,
  CalendarPlus,
  PhoneCall,
  Smartphone,
  PlayCircle,
  Globe,
  AtSign,
  Music,
  Share2,
  Home,
  Compass,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PATHS, getRoleHomePath } from '../routes/paths';
import { eventsService, toCard } from '../services/events.service';

export default function MainLayout() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [selectedCity, setSelectedCity] = useState('Toàn quốc');
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const searchWrapperRef = useRef(null);
  const citySelectorRef = useRef(null);
  const userMenuRef = useRef(null);

  // Scroll detection
  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        setSearchDropdownOpen(false);
      }
      if (citySelectorRef.current && !citySelectorRef.current.contains(e.target)) {
        setCityDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Gợi ý tìm kiếm từ API (debounce 300ms)
  const [searchResults, setSearchResults] = useState([]);
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return undefined;
    }
    let alive = true;
    const t = setTimeout(() => {
      eventsService
        .search({ q, limit: 5 })
        .then((r) => alive && setSearchResults((r.events || r.items || []).map((e) => toCard(e))))
        .catch(() => alive && setSearchResults([]));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [searchQuery]);

  const handleLogout = async () => {
    try {
      await logout();
      showToast('Đã đăng xuất tài khoản');
      navigate(PATHS.HOME);
    } catch {
      showToast('Đăng xuất hoàn tất');
    }
  };

  return (
    <div className='min-h-screen flex flex-col bg-white text-[#09090b]'>
      {/* Main Sticky Header */}
      <header className={`site-header ${headerScrolled ? 'scrolled' : ''}`}>
        <div className='tb-container header-inner'>
          {/* Logo */}
          <Link to={PATHS.HOME} className='brand-logo' title='EventTick'>
            <div className='brand-logo-mark'>
              <Ticket size={18} />
            </div>
            <div className='brand-logo-text'>
              <span className='brand-logo-title'>EventTick</span>
              <span className='brand-logo-tag'>B&amp;W EDITION</span>
            </div>
          </Link>

          {/* City Selector */}
          <div style={{ position: 'relative' }} ref={citySelectorRef}>
            <button
              type='button'
              className='city-selector-btn'
              onClick={() => setCityDropdownOpen((prev) => !prev)}
              aria-expanded={cityDropdownOpen}>
              <MapPin size={14} />
              <span>{selectedCity}</span>
              <ChevronDown size={12} />
            </button>

            {cityDropdownOpen && (
              <div className='city-dropdown-menu'>
                {['Toàn quốc', 'TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng'].map((city) => (
                  <button
                    key={city}
                    type='button'
                    className={`city-item ${selectedCity === city ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCity(city);
                      setCityDropdownOpen(false);
                      showToast(`Đã chuyển khu vực: ${city}`);
                    }}>
                    <span>{city}</span>
                    {selectedCity === city && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className='search-wrapper' ref={searchWrapperRef}>
            <div className='search-bar'>
              <Search size={16} className='text-[#71717a]' />
              <input
                type='text'
                className='search-input'
                placeholder='Tìm kiếm sự kiện, nghệ sĩ, địa điểm...'
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchDropdownOpen(true);
                }}
                onFocus={() => setSearchDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    setSearchDropdownOpen(false);
                    navigate(`${PATHS.SEARCH}?q=${encodeURIComponent(searchQuery.trim())}`);
                  }
                }}
              />
              {searchQuery.length > 0 && (
                <button
                  type='button'
                  className='search-clear-btn'
                  onClick={() => {
                    setSearchQuery('');
                    setSearchDropdownOpen(false);
                  }}
                  title='Xóa'>
                  <X size={13} />
                </button>
              )}
            </div>

            {searchDropdownOpen && searchQuery.trim().length >= 2 && (
              <div className='search-dropdown'>
                <div className='search-dropdown-title'>Gợi ý tìm kiếm</div>
                {searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <button
                      key={item.id}
                      type='button'
                      className='search-result-item'
                      onClick={() => {
                        setSearchDropdownOpen(false);
                        navigate(`/events/${item.id}`);
                      }}>
                      <img
                        src={item.image}
                        alt={item.name || item.title}
                        className='search-result-thumb'
                        onError={(e) => {
                          e.currentTarget.src = '/assets/banners/hero_0.jpg';
                        }}
                      />
                      <div className='search-result-info'>
                        <div className='search-result-name'>{item.name || item.title}</div>
                        <div className='search-result-meta'>
                          <span>{item.date}</span>
                          <span>•</span>
                          <span>{item.price}</span>
                          <span>•</span>
                          <span>{item.city || item.venue}</span>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div style={{ padding: '12px 8px', color: '#71717a', fontSize: '13px' }}>
                    Không tìm thấy sự kiện phù hợp với "{searchQuery}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Nav links */}
          <nav className='header-nav'>
            <Link to={PATHS.RESALE} className='nav-link'>
              <span>Bán lại vé</span>
              <span className='badge-pill-hot'>HOT</span>
            </Link>
          </nav>

          {/* Auth / Action */}
          <div className='header-actions'>
            <Link
              to={
                !user
                  ? PATHS.LOGIN
                  : user.role === 'ORGANIZER' || user.role === 'ADMIN'
                    ? PATHS.ORGANIZER_CREATE_EVENT
                    : PATHS.ORGANIZER_KYC
              }
              className='tb-btn tb-btn-outline tb-btn-sm header-create-btn'>
              <CalendarPlus size={15} />
              <span>Tạo sự kiện</span>
            </Link>

            {user ? (
              <div style={{ position: 'relative' }} ref={userMenuRef}>
                <button
                  type='button'
                  onClick={() => setUserDropdownOpen((prev) => !prev)}
                  className='tb-btn tb-btn-solid tb-btn-sm flex items-center gap-2'>
                  <User size={15} />
                  <span className='max-w-25 truncate'>{user.username || user.full_name || user.name}</span>
                  {user.role !== 'CUSTOMER' && (
                    <span className='text-[10px] bg-white text-black px-1.5 py-0.5 rounded font-bold'>{user.role}</span>
                  )}
                </button>

                {userDropdownOpen && (
                  <div className='absolute right-0 mt-2 w-48 bg-white border border-[#e4e4e7] rounded-xl shadow-lg py-1.5 z-50 text-xs'>
                    <div className='px-3 py-2 border-b border-[#f4f4f6]'>
                      <div className='font-bold text-[#09090b] truncate'>
                        {user.full_name || user.username || user.name}
                      </div>
                      <div className='text-[#71717a] text-[11px]'>
                        {{
                          CUSTOMER: 'Khách hàng',
                          ORGANIZER: 'Nhà tổ chức',
                          STAFF: 'Nhân viên soát vé',
                          ADMIN: 'Quản trị viên',
                        }[user.role] || user.role}
                      </div>
                    </div>
                    {user.role !== 'CUSTOMER' && (
                      <Link
                        to={getRoleHomePath(user.role)}
                        onClick={() => setUserDropdownOpen(false)}
                        className='block px-3 py-2 text-[#09090b] hover:bg-[#f4f4f6] font-medium'>
                        {user.role === 'STAFF' ? 'Soát vé' : 'Trang quản trị / Dashboard'}
                      </Link>
                    )}
                    <Link
                      to={PATHS.MY_TICKETS}
                      onClick={() => setUserDropdownOpen(false)}
                      className='block px-3 py-2 text-[#09090b] hover:bg-[#f4f4f6]'>
                      Vé của tôi
                    </Link>
                    <Link
                      to={PATHS.PROFILE}
                      onClick={() => setUserDropdownOpen(false)}
                      className='block px-3 py-2 text-[#09090b] hover:bg-[#f4f4f6]'>
                      Tài khoản của tôi
                    </Link>
                    {user.role === 'CUSTOMER' && (
                      <Link
                        to={PATHS.ORGANIZER_KYC}
                        onClick={() => setUserDropdownOpen(false)}
                        className='block px-3 py-2 text-[#09090b] hover:bg-[#f4f4f6] font-medium'>
                        Đăng ký thành nhà tổ chức
                      </Link>
                    )}
                    <button
                      type='button'
                      onClick={() => {
                        setUserDropdownOpen(false);
                        handleLogout();
                      }}
                      className='w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 flex items-center gap-1.5 border-t border-[#f4f4f6]'>
                      <LogOut size={13} />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className='flex items-center gap-2'>
                <Link to={PATHS.LOGIN} className='tb-btn tb-btn-solid tb-btn-sm'>
                  <User size={15} />
                  <span>Đăng nhập</span>
                </Link>
                <Link to={PATHS.REGISTER} className='tb-btn tb-btn-outline tb-btn-sm hidden sm:inline-flex'>
                  <span>Đăng ký</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Routed Content */}
      <main className='flex-1'>
        <Outlet context={{ selectedCity }} />
      </main>

      {/* Footer */}
      <footer className='site-footer' id='help'>
        <div className='tb-container'>
          <div className='footer-grid'>
            <div>
              <div className='footer-brand-title'>
                <div className='brand-logo-mark' style={{ width: '26px', height: '26px' }}>
                  <Ticket size={15} />
                </div>
                <span>EventTick</span>
              </div>
              <p className='footer-desc'>
                EventTick là nền tảng phân phối vé trực tuyến uy tín hàng đầu tại Việt Nam, mang đến trải nghiệm mua vé
                an toàn, nhanh chóng và hiện đại.
              </p>
              <div className='footer-hotline'>
                <PhoneCall size={17} />
                <span>Hotline: 1900-6408 (8:30 - 18:30)</span>
              </div>
            </div>

            <div>
              <h4 className='footer-heading'>Khám phá</h4>
              <ul className='footer-links'>
                <li>
                  <Link to={PATHS.HOME}>Sự kiện xu hướng</Link>
                </li>
                <li>
                  <Link to={PATHS.HOME}>Hòa nhạc &amp; Liveshow</Link>
                </li>
                <li>
                  <Link to={PATHS.HOME}>Sân khấu kịch nghệ</Link>
                </li>
                <li>
                  <Link to={PATHS.HOME}>Workshop &amp; Khóa học</Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className='footer-heading'>Chính sách</h4>
              <ul className='footer-links'>
                <li>
                  <button type='button' onClick={() => showToast('Điều khoản dịch vụ EventTick')}>
                    Điều khoản sử dụng
                  </button>
                </li>
                <li>
                  <button type='button' onClick={() => showToast('Chính sách bảo mật EventTick')}>
                    Chính sách bảo mật
                  </button>
                </li>
                <li>
                  <button type='button' onClick={() => showToast('Quy định hoàn tiền vé')}>
                    Quy định hoàn tiền
                  </button>
                </li>
                <li>
                  <button type='button' onClick={() => showToast('Chính sách bảo vệ người mua vé')}>
                    Bán lại vé an toàn
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className='footer-bottom items-center justify-center text-center'>
            <div>&copy; 2026 EventTick Company Limited. Giấy chứng nhận ĐKKD số 12345678.</div>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      <nav className='mobile-bottom-bar'>
        <Link to={PATHS.HOME} className={`mobile-tab-btn ${location.pathname === '/' ? 'active' : ''}`}>
          <Home size={20} />
          <span>Trang chủ</span>
        </Link>
        <Link to={PATHS.HOME} className='mobile-tab-btn'>
          <Compass size={20} />
          <span>Khám phá</span>
        </Link>
        <Link to={user ? PATHS.MY_TICKETS : PATHS.LOGIN} className='mobile-tab-btn'>
          <Ticket size={20} />
          <span>Vé của tôi</span>
        </Link>
        <Link to={user ? PATHS.PROFILE : PATHS.LOGIN} className='mobile-tab-btn'>
          <User size={20} />
          <span>Tài khoản</span>
        </Link>
      </nav>
    </div>
  );
}
