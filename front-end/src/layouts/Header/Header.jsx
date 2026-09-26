import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PATHS } from "@/routes/paths";
import "./Header.css";

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const searchTimeoutRef = useRef(null);

  // Sync search term from URL if on search page
  useEffect(() => {
    if (location.pathname === "/search") {
      const params = new URLSearchParams(location.search);
      setSearchTerm(params.get("name") || "");
    } else {
      setSearchTerm("");
    }
  }, [location.pathname, location.search]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (value.trim()) {
        navigate(`/search?name=${encodeURIComponent(value.trim())}`);
      } else if (location.pathname === "/search") {
        navigate(`/search`);
      }
    }, 500);
  };

  const handleCategoryClick = (category) => {
    navigate(`/search?category=${encodeURIComponent(category)}`);
  };

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      await logout();
      navigate(PATHS.HOME);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  return (
    <header>
      <div className="top-header">
        <Link to={PATHS.HOME} className="logo-link">
          ticketbox
        </Link>

        <div className="search-container">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M10 2a8 8 0 105.293 14.293l4.707 4.707 1.414-1.414-4.707-4.707A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z" />
          </svg>
          <input
            type="text"
            placeholder="Bạn tìm gì hôm nay?"
            className="header-search"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <button className="header-search-btn">Tìm kiếm</button>
        </div>

        <div className="actions">
          <Link to={PATHS.ADMIN_CREATE_EVENT} className="action-btn">
            Tạo sự kiện
          </Link>
          <Link to={PATHS.USER_TICKETS} className="action-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 4v16"/><path d="M17 4v16"/></svg>
            Vé của tôi
          </Link>

          {!user ? (
            <Link to={PATHS.LOGIN} className="action-link">
              Đăng nhập | Đăng ký
            </Link>
          ) : (
            <div className="account-menu">
              <div className="action-link" style={{ cursor: "pointer" }}>
                👤 {user.username || user.userName || "Tài khoản"}
              </div>
              <div className="dropdown">
                <Link to={PATHS.USER_TICKETS}>🎟 Vé của tôi</Link>
                <Link to={PATHS.ADMIN_MY_EVENTS}>📅 Sự kiện của tôi</Link>
                <Link to={PATHS.USER_ACCOUNT}>⚙️ Tài khoản của tôi</Link>
                <p style={{ margin: 0 }}>
                  <a href="#logout" onClick={handleLogout}>
                    🚪 Đăng xuất
                  </a>
                </p>
              </div>
            </div>
          )}

          <div className="language-selector">
            <div className="flag">🇻🇳</div>
            <div className="dropdown">
              <button>VN</button>
              <button>EN</button>
            </div>
          </div>
        </div>
      </div>

      <nav className="header-nav-bar">
        <button onClick={() => handleCategoryClick("Nhạc Sống")}>Nhạc sống</button>
        <button onClick={() => handleCategoryClick("Sân khấu & Nghệ thuật")}>Sân khấu & Nghệ thuật</button>
        <button onClick={() => handleCategoryClick("Thể Thao")}>Thể Thao</button>
        <button onClick={() => handleCategoryClick("Hội thảo & Workshop")}>Hội thảo & Workshop</button>
        <button onClick={() => handleCategoryClick("Sự kiện ngoài trời")}>Tham quan & Trải nghiệm</button>
        <button onClick={() => handleCategoryClick("Khác")}>Khác</button>
        <button>Về bán lại</button>
        <button>Blog</button>
      </nav>
    </header>
  );
};

export default Header;
