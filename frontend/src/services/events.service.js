import { api } from '../api/client';

const SLUG_TO_KEY = {
  'nhac-song-concert': 'music',
  'test-am-nhac': 'music',
  'san-khau-nghe-thuat': 'theatersandart',
  'the-thao': 'sport',
  'hoi-thao-workshop': 'seminarsworkshops',
  khac: 'others',
};

const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '');

/** Chuyển sự kiện từ API sang dạng thẻ dùng trong giao diện. */
export function toCard(e, categoryById = {}, extra = {}) {
  const price = e.lowestPrice ?? e.lowest_price ?? 0;
  return {
    id: e.id || e._id,
    name: e.title || e.eventName,
    title: e.title || e.eventName,
    subtitle: String(e.description || '').replace(/<[^>]*>/g, '').slice(0, 160),
    date: fmtDate(e.start_time || e.earliestDate),
    venue: e.venue_name || e.venueName,
    city: e.city,
    price: price > 0 ? `Từ ${money(price)}` : 'Miễn phí',
    basePrice: price,
    image: e.thumbnail_url || e.banner_url || e.eventImage,
    banner: e.banner_url || e.thumbnail_url,
    category: SLUG_TO_KEY[categoryById[e.category_id]] || 'others',
    hasSeatMap: !!e.has_seat_map,
    ...extra,
  };
}

const list = (r) => r?.events || r?.items || [];

export const eventsService = {
  categories: () => api.get('/categories'),
  inBanner: () => api.get('/events/in-banner'),
  trending: () => api.get('/events/trending'),
  recommend: () => api.get('/events/recommend'),
  latestWeek: () => api.get('/events/latest/week'),
  latestMonth: () => api.get('/events/latest/month'),
  search: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return api.get(`/events/search?${qs}`);
  },
  detail: (id) => api.get(`/events/${id}`),

  /** Tải toàn bộ dữ liệu trang chủ trong 1 lần. */
  async loadHome() {
    const [cats, banner, trending, week, month, all] = await Promise.all([
      this.categories().catch(() => ({ categories: [] })),
      this.inBanner().catch(() => ({})),
      this.trending().catch(() => ({})),
      this.latestWeek().catch(() => ({})),
      this.latestMonth().catch(() => ({})),
      this.search({ limit: 50 }).catch(() => ({})),
    ]);
    const byId = Object.fromEntries((cats.categories || []).map((c) => [c._id || c.id, c.slug]));
    const map = (r, extra) => list(r).map((e, i) => toCard(e, byId, extra ? extra(i) : {}));
    const allCards = map(all);
    return {
      hero: map(banner, () => ({ badge: 'Sự kiện nổi bật' })),
      trending: map(trending, (i) => ({ rank: i + 1 })),
      week: map(week),
      month: map(month),
      all: allCards,
    };
  },
};

export default eventsService;
