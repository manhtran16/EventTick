import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PATHS } from "@/routes/paths";
import "./Header.css";

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = () => {
    if (searchTerm.trim()) {
      navigate(`/search?name=${encodeURIComponent(searchTerm)}`);
    }
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
        <div className="logo">
          <Link to={PATHS.HOME} className="logo-link">
            Ticketbox
          </Link>
        </div>

        <div>
          <input
            type="text"
            placeholder="Bạn tìm gì hôm nay?"
            className="header-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            className="header-search-btn"
            onClick={handleSearch}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "white",
              fontSize: "20px",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M10 2a8 8 0 105.293 14.293l4.707 4.707 1.414-1.414-4.707-4.707A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z" />
            </svg>
          </button>
        </div>

        <div className="actions">
          {/* Navigation buttons */}
          <Link to={PATHS.ADMIN_CREATE_EVENT}>
            <button>Tạo sự kiện</button>
          </Link>
          <Link to={PATHS.USER_TICKETS}>
            <button>Vé của tôi</button>
          </Link>

          {/* Conditional rendering based on user */}
          {!user ? (
            <>
              <Link to={PATHS.LOGIN}>
                <button>Đăng nhập</button>
              </Link>
              <Link to={PATHS.REGISTER}>
                <button>Đăng ký</button>
              </Link>
            </>
          ) : (
            <div className="account-menu">
              <button className="account-btn">
                👤 {user.username || user.userName || "Tài khoản"}
              </button>
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

          {/* Language selector */}
          <div className="language-selector">
            <button className="flag">🇻🇳</button>
            <div className="dropdown">
              <button>VN</button>
              <button>EN</button>
            </div>
          </div>
        </div>
      </div>

      <nav className="header-nav-bar">
        <button onClick={() => handleCategoryClick("Nhạc sống & Concert")}>
          Nhạc sống & Concert
        </button>
        <button onClick={() => handleCategoryClick("Sân khấu & Nghệ thuật")}>
          Sân khấu & Nghệ thuật
        </button>
        <button onClick={() => handleCategoryClick("Thể Thao")}>
          Thể Thao
        </button>
        <button onClick={() => handleCategoryClick("Hội thảo & Workshop")}>
          Hội thảo & Workshop
        </button>
        <button onClick={() => handleCategoryClick("Tham quan & Trải nghiệm")}>
          Tham quan & Trải nghiệm
        </button>
        <button onClick={() => handleCategoryClick("Khác")}>Khác</button>
      </nav>
    </header>
  );
};

export default Header;
