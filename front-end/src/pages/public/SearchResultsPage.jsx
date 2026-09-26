import React, { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import eventService from "@/services/event.service";
import { EventItemCard } from "@/features/events";
import "./SearchResultsPage.css";

const CATEGORIES = [
  "Nhạc Sống",
  "Sân Khấu & Nghệ Thuật",
  "Thể Thao",
  "Hội thảo & Workshop",
  "Sự kiện ngoài trời",
];

const SearchResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 12, totalPages: 1 });

  // State for filters
  const [filters, setFilters] = useState({
    name: "",
    category: "",
    eventType: "",
    priceMin: "",
    priceMax: "",
    sort: "createdAt_desc"
  });

  // Sync state with URL only on mount (so user can share links)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setFilters({
      name: params.get("name") || "",
      category: params.get("category") || "",
      eventType: params.get("eventType") || "",
      priceMin: params.get("priceMin") || "",
      priceMax: params.get("priceMax") || "",
      sort: params.get("sort") || "createdAt_desc"
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Fetch events based on current URL params
  const fetchEvents = useCallback(async (pageToFetch = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams(location.search);
      const searchParams = {
        name: params.get("name") || "",
        category: params.get("category") || "",
        eventType: params.get("eventType") || "",
        priceMin: params.get("priceMin") || "",
        priceMax: params.get("priceMax") || "",
        sort: params.get("sort") || "createdAt_desc",
        page: pageToFetch,
        limit: 12
      };

      const data = await eventService.searchEvents(searchParams);
      if (data.success) {
        setEvents(data.events || []);
        setPagination(data.pagination || { total: 0, page: 1, limit: 12, totalPages: 1 });
      } else {
        setEvents(Array.isArray(data) ? data : data.events || []);
      }
    } catch (err) {
      console.error("Error fetching events:", err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const currentPage = parseInt(params.get("page"), 10) || 1;
    fetchEvents(currentPage);
  }, [fetchEvents, location.search]);

  // Auto-apply filters when local 'filters' state changes (with 500ms debounce)
  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      // Preserve current page or reset to 1 if it's a new filter search?
      // Since filters changed, reset to page 1
      params.set("page", "1");
      // Use replace: true so we don't spam the browser history on every keystroke
      navigate(`/search?${params.toString()}`, { replace: true });
    }, 500);

    return () => clearTimeout(handler);
  }, [filters, navigate]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    const params = new URLSearchParams(location.search);
    params.set("page", newPage);
    navigate(`/search?${params.toString()}`);
  };

  const clearFilters = () => {
    const defaultFilters = { name: "", category: "", eventType: "", priceMin: "", priceMax: "", sort: "createdAt_desc" };
    setFilters(defaultFilters);
    // The debounce useEffect will automatically trigger the navigation
  };

  return (
    <div className="search-results-layout">
      {/* SIDEBAR FILTERS */}
      <div className="search-sidebar">
        <h3>Bộ lọc tìm kiếm</h3>
        
        <div className="filter-group">
          <label>Từ khóa (Tên, địa điểm)</label>
          <input type="text" name="name" value={filters.name} onChange={handleFilterChange} placeholder="Nhập từ khóa..." />
        </div>

        <div className="filter-group">
          <label>Danh mục</label>
          <select name="category" value={filters.category} onChange={handleFilterChange}>
            <option value="">Tất cả danh mục</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="filter-group">
          <label>Loại sự kiện</label>
          <select name="eventType" value={filters.eventType} onChange={handleFilterChange}>
            <option value="">Tất cả</option>
            <option value="offline">Sự kiện Offline</option>
            <option value="online">Sự kiện Online</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Khoảng giá (VNĐ)</label>
          <div className="price-range">
            <input type="number" name="priceMin" value={filters.priceMin} onChange={handleFilterChange} placeholder="Từ" min="0" />
            <span>-</span>
            <input type="number" name="priceMax" value={filters.priceMax} onChange={handleFilterChange} placeholder="Đến" min="0" />
          </div>
        </div>

        <div className="filter-group">
          <label>Sắp xếp theo</label>
          <select name="sort" value={filters.sort} onChange={handleFilterChange}>
            <option value="createdAt_desc">Mới nhất</option>
            <option value="price_asc">Giá: Thấp đến cao</option>
            <option value="price_desc">Giá: Cao đến thấp</option>
            <option value="date_asc">Thời gian diễn ra: Gần nhất</option>
            <option value="date_desc">Thời gian diễn ra: Xa nhất</option>
          </select>
        </div>


        <button 
          onClick={clearFilters}
          style={{ width: "100%", padding: "12px", background: "#333", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Xóa bộ lọc
        </button>
      </div>

      {/* MAIN RESULTS */}
      <div className="search-main">
        <div className="search-header">
          <h1>Kết quả tìm kiếm</h1>
          <span style={{ color: "#888" }}>{pagination.total} sự kiện được tìm thấy</span>
        </div>

        {loading ? (
          <p>Đang tìm kiếm...</p>
        ) : events.length > 0 ? (
          <>
            <EventItemCard events={events} title={null} />
            
            {/* PAGINATION */}
            {pagination.totalPages > 1 && (
              <div className="pagination-controls">
                <button 
                  disabled={pagination.page <= 1} 
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  Trang trước
                </button>
                <span>Trang {pagination.page} / {pagination.totalPages}</span>
                <button 
                  disabled={pagination.page >= pagination.totalPages} 
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  Trang sau
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "50px", background: "#111", borderRadius: "8px" }}>
            <p style={{ fontSize: "18px", color: "#888" }}>Không tìm thấy sự kiện nào phù hợp với bộ lọc của bạn.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResultsPage;
