import { useState, useEffect, useRef } from 'react';
import { useNavigate, useOutletContext, Link } from 'react-router-dom';
import {
  Sparkles,
  Music,
  Film,
  Trophy,
  Presentation,
  Compass,
  Layers,
  Calendar,
  MapPin,
  Armchair,
  Ticket,
  ChevronLeft,
  ChevronRight,
  Flame,
  ArrowRight,
  Palette,
  Award,
  Briefcase,
  Download,
} from 'lucide-react';
import { getCategoryName } from '../../data/mockData';
import { eventsService } from '../../services/events.service';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';

export default function HomePage() {
  const { selectedCity = 'Toàn quốc' } = useOutletContext() || {};
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState('all');
  const [timeTab, setTimeTab] = useState('weekend');
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHeroHovered, setIsHeroHovered] = useState(false);

  const [data, setData] = useState({ hero: [], trending: [], week: [], month: [], all: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const trendingSliderRef = useRef(null);

  useEffect(() => {
    let alive = true;
    eventsService
      .loadHome()
      .then((d) => alive && setData(d))
      .catch((err) => alive && setLoadError(err.message || 'Không tải được danh sách sự kiện'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const heroBanners = data.hero.length ? data.hero : data.all.slice(0, 4);
  const trendingList = data.trending.length ? data.trending.map((e, i) => ({ ...e, rank: i + 1 })) : data.all.slice(0, 10).map((e, i) => ({ ...e, rank: i + 1 }));
  const timeList = timeTab === 'weekend' ? data.week : data.month;
  const musicList = data.all.filter((e) => e.category === 'music').slice(0, 4);
  const stageList = data.all.filter((e) => e.category !== 'music').slice(0, 4);

  useEffect(() => {
    if (isHeroHovered || heroBanners.length < 2) return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isHeroHovered, heroBanners.length]);

  const matchesFilter = (ev) => {
    const matchesCategory = activeCategory === 'all' || ev.category === activeCategory;
    const matchesCity =
      selectedCity === 'Toàn quốc' ||
      !ev.city ||
      ev.city.includes(selectedCity) ||
      (selectedCity === 'TP. Hồ Chí Minh' && (ev.city.includes('TP.HCM') || ev.city.includes('TP. Hồ Chí Minh')));
    return matchesCategory && matchesCity;
  };


  const renderCard = (event, isRanked = false) => {
    if (!matchesFilter(event)) return null;

    return (
      <div key={event.id} className='event-card'>
        <button
          type='button'
          onClick={() => navigate(`/events/${event.id}`)}
          className='card-thumb-wrap'
          title={`Xem chi tiết ${event.name || event.title}`}>
          <img
            src={event.image}
            alt={event.name || event.title}
            className='card-thumb'
            loading='lazy'
            onError={(e) => {
              e.currentTarget.src = '/assets/banners/hero_0.jpg';
            }}
          />
          {isRanked && <div className={`rank-badge ${event.rank <= 3 ? 'top-3' : ''}`}>#{event.rank}</div>}
          <div className='card-tag'>{getCategoryName(event.category)}</div>
        </button>

        <div className='card-body'>
          <div className='card-date-row'>
            <Calendar size={13} />
            <span>{event.date}</span>
          </div>

          <h3 className='card-title'>
            <button
              type='button'
              onClick={() => navigate(`/events/${event.id}`)}
              className='hover:underline text-left'
              title={event.name || event.title}>
              {event.name || event.title}
            </button>
          </h3>

          <div className='card-footer-row'>
            <div className='card-price-group'>
              <span className='card-price-label'>Giá từ</span>
              <span className='card-price-val'>{event.price}</span>
            </div>
            <div className='card-city'>
              <MapPin size={12} />
              <span>{event.city}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button type='button' className='card-book-btn' onClick={() => navigate(`/events/${event.id}`)}>
              <Ticket size={14} />
              <span>Đặt vé</span>
            </button>
            <button
              type='button'
              className='tb-btn tb-btn-outline tb-btn-sm'
              style={{ height: '38px', borderRadius: 'var(--radius-md)', padding: '0 12px' }}
              title='Xem sơ đồ chọn ghế ngồi'
              onClick={() => navigate(`/events/${event.id}`)}>
              <Armchair size={15} />
              <span className='hidden sm:inline'>Chọn ghế</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {loading && <div className='tb-container' style={{ padding: '24px 0', color: '#71717a' }}>Đang tải sự kiện...</div>}
      {loadError && <div className='tb-container' style={{ padding: '24px 0', color: '#b91c1c' }}>{loadError}</div>}
      {!loading && !loadError && data.all.length === 0 && <div className='tb-container' style={{ padding: '24px 0', color: '#71717a' }}>Chưa có sự kiện nào được mở bán.</div>}

      {/* CATEGORY FILTER STRIP */}
      <div className='category-strip'>
        <div className='tb-container'>
          <div className='category-list'>
            {[
              { key: 'all', label: 'Tất cả sự kiện', icon: Sparkles },
              { key: 'music', label: 'Nhạc sống', icon: Music },
              { key: 'theatersandart', label: 'Sân khấu & Nghệ thuật', icon: Film },
              { key: 'sport', label: 'Thể thao', icon: Trophy },
              { key: 'seminarsworkshops', label: 'Hội thảo & Workshop', icon: Presentation },
              { key: 'attractionsexperiences', label: 'Tham quan & Trải nghiệm', icon: Compass },
              { key: 'others', label: 'Khác', icon: Layers },
            ].map((cat) => {
              const CatIcon = cat.icon;
              return (
                <button
                  key={cat.key}
                  type='button'
                  className={`category-pill ${activeCategory === cat.key ? 'active' : ''}`}
                  onClick={() => {
                    setActiveCategory(cat.key);
                    showToast(`Đang lọc: ${cat.label}`);
                  }}>
                  <CatIcon size={15} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* HERO CAROUSEL */}
      {heroBanners.length > 0 && (
      <section className='hero-section'>
        <div className='tb-container'>
          <div
            className='hero-carousel-container'
            onMouseEnter={() => setIsHeroHovered(true)}
            onMouseLeave={() => setIsHeroHovered(false)}>
            <div className='hero-slides'>
              {heroBanners.map((banner, idx) => (
                <div key={banner.id} className={`hero-slide ${idx === heroIndex ? 'active' : ''}`}>
                  <div className='hero-content'>
                    <div className='hero-badge'>
                      <Sparkles size={12} />
                      <span>{banner.badge}</span>
                    </div>
                    <h1 className='hero-title'>{banner.title}</h1>
                    <p className='hero-desc'>{banner.subtitle}</p>
                    <div className='hero-meta-row'>
                      <div className='hero-meta-item'>
                        <Calendar size={15} />
                        <span>{banner.date}</span>
                      </div>
                      <div className='hero-meta-item'>
                        <MapPin size={15} />
                        <span>{banner.venue}</span>
                      </div>
                      <div className='hero-meta-item'>
                        <span style={{ color: '#a1a1aa' }}>Giá:</span>
                        <span className='hero-price'>{banner.price}</span>
                      </div>
                    </div>
                    <div className='hero-actions'>
                      <button
                        type='button'
                        className='hero-btn-primary'
                        onClick={() => navigate(`/events/${banner.id}`)}>
                        <Armchair size={16} />
                        <span>Chọn ghế &amp; Đặt vé</span>
                      </button>
                      <button
                        type='button'
                        className='hero-btn-secondary'
                        onClick={() => navigate(`/events/${banner.id}`)}>
                        <Ticket size={16} />
                        <span>Xem chi tiết</span>
                      </button>
                    </div>
                  </div>
                  <div className='hero-media'>
                    <img
                      src={banner.image}
                      alt={banner.title}
                      onError={(e) => {
                        e.currentTarget.src = '/assets/banners/hero_0.jpg';
                      }}
                    />
                    <div className='hero-media-gradient' />
                  </div>
                </div>
              ))}
            </div>

            <button
              type='button'
              className='hero-nav-btn prev'
              onClick={() =>
                setHeroIndex((prev) => (prev - 1 + heroBanners.length) % heroBanners.length)
              }
              aria-label='Slide trước'>
              <ChevronLeft size={18} />
            </button>
            <button
              type='button'
              className='hero-nav-btn next'
              onClick={() => setHeroIndex((prev) => (prev + 1) % heroBanners.length)}
              aria-label='Slide tiếp theo'>
              <ChevronRight size={18} />
            </button>

            <div className='hero-indicators'>
              {heroBanners.map((_, idx) => (
                <button
                  key={idx}
                  type='button'
                  className={`hero-dot ${idx === heroIndex ? 'active' : ''}`}
                  onClick={() => setHeroIndex(idx)}
                  aria-label={`Chuyển đến slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      )}

      {/* TRENDING TOP 10 */}
      <section className='section-wrap' id='trending'>
        <div className='tb-container'>
          <div className='section-header'>
            <div className='section-title-wrap'>
              <h2 className='section-title'>
                <Flame size={20} />
                <span>Sự kiện xu hướng</span>
              </h2>
              <p className='section-subtitle'>Top các sự kiện đang được săn vé nhiều nhất trong tuần</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type='button'
                className='tb-btn tb-btn-outline tb-btn-sm'
                onClick={() => trendingSliderRef.current?.scrollBy({ left: -340, behavior: 'smooth' })}
                aria-label='Cuộn sang trái'>
                <ChevronLeft size={15} />
              </button>
              <button
                type='button'
                className='tb-btn tb-btn-outline tb-btn-sm'
                onClick={() => trendingSliderRef.current?.scrollBy({ left: 340, behavior: 'smooth' })}
                aria-label='Cuộn sang phải'>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <div className='horizontal-slider' ref={trendingSliderRef}>
            {trendingList.map((event) => {
              const card = renderCard(event, true);
              if (!card) return null;
              return (
                <div key={event.id} className='slider-card-item'>
                  {card}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* KHÁM PHÁ THEO THỜI GIAN */}
      <section className='section-wrap' id='weekend' style={{ background: 'var(--bg-surface)', padding: '48px 0' }}>
        <div className='tb-container'>
          <div className='section-header'>
            <div className='section-title-wrap'>
              <h2 className='section-title'>
                <Calendar size={20} />
                <span>Khám phá theo thời gian</span>
              </h2>
              <p className='section-subtitle'>Lên lịch trải nghiệm cùng bạn bè và gia đình</p>
            </div>
            <div className='filter-tabs'>
              <button
                type='button'
                className={`filter-tab-btn ${timeTab === 'weekend' ? 'active' : ''}`}
                onClick={() => setTimeTab('weekend')}>
                Cuối tuần này
              </button>
              <button
                type='button'
                className={`filter-tab-btn ${timeTab === 'month' ? 'active' : ''}`}
                onClick={() => setTimeTab('month')}>
                Tháng này
              </button>
            </div>
          </div>

          <div className='events-grid'>
            {timeList.map((event) => renderCard(event))}
          </div>
        </div>
      </section>

      {/* NHẠC SỐNG */}
      <section className='section-wrap' id='musicSection'>
        <div className='tb-container'>
          <div className='section-header'>
            <div className='section-title-wrap'>
              <h2 className='section-title'>
                <Music size={20} />
                <span>Nhạc sống sôi động</span>
              </h2>
              <p className='section-subtitle'>Hòa mình vào không gian âm nhạc từ ca sĩ và ban nhạc yêu thích</p>
            </div>
            <button
              type='button'
              className='section-more-link'
              onClick={() => navigate(`${PATHS.SEARCH}?category=nhac-song-concert`)}>
              <span>Xem thêm nhạc sống</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className='events-grid'>
            {musicList.map((event) => renderCard(event))}
          </div>
        </div>
      </section>

      {/* SÂN KHẤU, KỊCH & WORKSHOP */}
      <section className='section-wrap' style={{ background: 'var(--bg-surface)', padding: '48px 0' }}>
        <div className='tb-container'>
          <div className='section-header'>
            <div className='section-title-wrap'>
              <h2 className='section-title'>
                <Palette size={20} />
                <span>Sân khấu, Kịch &amp; Trải nghiệm</span>
              </h2>
              <p className='section-subtitle'>Thưởng thức nghệ thuật biểu diễn và những buổi học trải nghiệm thú vị</p>
            </div>
          </div>

          <div className='events-grid'>
            {stageList.map((event) => renderCard(event))}
          </div>
        </div>
      </section>

      {/* ORGANIZER BANNER */}
      <section className='tb-container' id='organizer'>
        <div className='organizer-banner'>
          <div className='organizer-content'>
            <div className='organizer-tag'>
              <Award size={14} />
              <span>Giải pháp bán vé toàn diện</span>
            </div>
            <h2 className='organizer-title'>Tổ chức sự kiện cùng EventTick</h2>
            <p className='organizer-desc'>
              Tiếp cận hơn 3.000.000 khán giả yêu giải trí tại Việt Nam. Nền tảng bán vé ổn định, soát vé mã QR thông
              minh với tỉ lệ xử lý 1000 vé/phút và báo cáo thời gian thực.
            </p>
          </div>
          <div className='organizer-actions'>
            <Link to={PATHS.REGISTER} className='tb-btn tb-btn-white'>
              <Briefcase size={15} />
              <span>Đăng ký đối tác</span>
            </Link>
            <button
              type='button'
              className='tb-btn tb-btn-outline'
              style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', background: 'transparent' }}
              onClick={() => showToast('Tải tài liệu giới thiệu giải pháp EventTick Business')}>
              <Download size={15} />
              <span>Tải tài liệu</span>
            </button>
          </div>
        </div>
      </section>

    </>
  );
}
