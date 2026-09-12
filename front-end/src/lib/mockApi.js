// ============================================================================
// MOCK API — chỉ dùng để xem/ tham khảo giao diện khi CHƯA có backend thật.
// File này chặn (intercept) mọi request của axiosInstance và trả về dữ liệu giả.
//
// Cách tắt: xoá dòng import "./lib/mockApi" trong src/index.jsx,
// hoặc đặt VITE_USE_MOCK=false trong file .env rồi build lại.
// ============================================================================

import MockAdapter from "axios-mock-adapter";
import { axiosInstance } from "./axios";

// delay giả lập network ~300ms cho giống thật
const mock = new MockAdapter(axiosInstance, { delayResponse: 300 });

// ---------------------------------------------------------------------------
// Dữ liệu sự kiện mẫu
// ---------------------------------------------------------------------------
const CATEGORIES = [
  "Nhạc sống & Concert",
  "Sân khấu & Nghệ thuật",
  "Thể Thao",
  "Hội thảo & Workshop",
  "Tham quan & Trải nghiệm",
];

const EVENT_NAMES = [
  "Anh Trai Say Hi - Concert Tour 2026",
  "Chương Trình Hòa Nhạc Mùa Thu",
  "Workshop Thiết Kế UI/UX Cho Người Mới",
  "Giải Chạy Marathon Thành Phố",
  "Đêm Nhạc Acoustic Sài Gòn",
  "Triển Lãm Nghệ Thuật Đương Đại",
  "Hội Thảo Khởi Nghiệp 2026",
  "Lễ Hội Ẩm Thực Đường Phố",
  "Vở Kịch Kinh Điển: Số Đỏ",
  "Ngày Hội Sách Và Văn Hoá Đọc",
  "Concert K-Pop Fanmeeting",
  "Giải Bóng Đá Giao Hữu Quốc Tế",
];

function makeEvent(i) {
  const id = `evt_${i.toString().padStart(3, "0")}`;
  const today = new Date();
  const earliest = new Date(today);
  earliest.setDate(today.getDate() + (i % 15) + 1);

  const sessions = Array.from({ length: 2 }).map((_, sIdx) => {
    const d = new Date(earliest);
    d.setDate(d.getDate() + sIdx * 3);
    const start = new Date(d);
    start.setHours(19, 0, 0, 0);
    return {
      eventDate: d.toISOString(),
      startTime: start.toISOString(),
      tickets: [
        { name: "Vé Thường", price: 300000 + i * 10000, soldOut: "false" },
        { name: "Vé VIP", price: 800000 + i * 10000, soldOut: i % 5 === 0 ? "true" : "false" },
        { name: "Vé VVIP", price: 1500000 + i * 10000, soldOut: "false" },
      ],
    };
  });

  return {
    _id: id,
    eventName: EVENT_NAMES[i % EVENT_NAMES.length],
    backgroundImage: `https://picsum.photos/seed/ticketerra-${i}/800/450`,
    lowestPrice: 300000 + i * 10000,
    earliestDate: earliest.toISOString(),
    lastDate: sessions[sessions.length - 1].eventDate,
    venueName: "Nhà Thi Đấu Quân Khu 7, TP. Hồ Chí Minh",
    category: CATEGORIES[i % CATEGORIES.length],
    eventDesc:
      "<p>Đây là mô tả mẫu cho sự kiện dùng để xem giao diện. " +
      "Nội dung chi tiết, hình ảnh, lịch trình... sẽ được hiển thị đầy đủ ở đây khi có dữ liệu thật từ backend.</p>",
    organizerInfo: "<p><strong>Đơn vị tổ chức:</strong> Ticketerra Demo Co., Ltd.</p>",
    sessions,
  };
}

const ALL_EVENTS = Array.from({ length: 12 }).map((_, i) => makeEvent(i + 1));

function findEvent(id) {
  return ALL_EVENTS.find((e) => e._id === id) || ALL_EVENTS[0];
}

// ---------------------------------------------------------------------------
// Trạng thái đăng nhập giả (chỉ tồn tại trong phiên trình duyệt hiện tại)
// ---------------------------------------------------------------------------
let mockUser = null; // đổi thành { username: "demo" } nếu muốn mặc định đã đăng nhập
const mockUsersDb = [
  { username: "demo_user", password: "123", name: "Nguyễn Văn Demo" },
  { username: "demo_organizer", password: "123", name: "Ban Tổ Chức Demo" },
];

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------
mock.onGet("/auth").reply(() => {
  return [200, { user: mockUser }];
});

mock.onPost("/auth/login").reply((config) => {
  const body = JSON.parse(config.data || "{}");
  const found = mockUsersDb.find((u) => u.username === body.username);
  mockUser = {
    username: body.username || "demo_user",
    name: found?.name || body.username || "Demo User",
  };
  return [200, { success: true, message: "Đăng nhập thành công (demo)", user: mockUser }];
});

mock.onPost("/auth/register").reply((config) => {
  const body = JSON.parse(config.data || "{}");
  mockUsersDb.push({
    username: body.username,
    password: body.password,
    name: body.username,
  });
  return [200, { success: true, message: `Tạo tài khoản "${body.username}" thành công (demo)` }];
});

mock.onGet("/auth/logout").reply(() => {
  mockUser = null;
  return [200, { success: true }];
});

mock.onGet("/auth/user").reply(() => {
  return [
    200,
    {
      success: true,
      user: {
        userName: mockUser?.username || "demo_user",
        name: mockUser?.name || "Nguyễn Văn Demo",
        phone: "0901234567",
        dob: "1999-01-01",
        gender: "Nam",
      },
    },
  ];
});

mock.onPost("/auth/user/my-account").reply(200, { success: true });
mock.onGet("/events/auth").reply(200, { success: true });


// ---------------------------------------------------------------------------
// EVENTS — trang chủ
// ---------------------------------------------------------------------------
mock.onGet(/\/events\/in-banner/).reply(200, { events: ALL_EVENTS.slice(0, 5) });
mock.onGet(/\/events\/trending/).reply(200, { success: true, events: ALL_EVENTS.slice(2, 9) });
mock.onGet(/\/events\/in-special/).reply(200, { success: true, events: ALL_EVENTS.slice(0, 6) });
mock.onGet(/\/events\/recommend/).reply(200, { events: ALL_EVENTS.slice(3, 10) });
mock.onGet(/\/events\/latest\/week/).reply(200, { success: true, events: ALL_EVENTS.slice(0, 6) });
mock.onGet(/\/events\/latest\/month/).reply(200, { success: true, events: ALL_EVENTS.slice(4, 12) });

// ---------------------------------------------------------------------------
// EVENTS — tìm kiếm & chi tiết
// ---------------------------------------------------------------------------
mock.onGet(/\/events\/search/).reply((config) => {
  const url = new URL(config.url, "http://x");
  const name = url.searchParams.get("name");
  const category = url.searchParams.get("category");
  let results = ALL_EVENTS;
  if (name) {
    results = ALL_EVENTS.filter((e) =>
      e.eventName.toLowerCase().includes(name.toLowerCase()),
    );
  } else if (category) {
    results = ALL_EVENTS.filter((e) => e.category === category);
  }
  return [200, { events: results }];
});

mock.onGet(/\/events\/my-event/).reply(200, {
  success: true,
  events: ALL_EVENTS.slice(0, 3).map((e) => ({
    _id: e._id,
    eventName: e.eventName,
    eventImage: e.backgroundImage,
    eventAddress: e.venueName,
  })),
});

// Chi tiết sự kiện theo id — đặt SAU CÙNG vì regex khá rộng
mock.onGet(/\/events\/[^/?]+$/).reply((config) => {
  const id = config.url.split("/").pop();
  return [200, { success: true, event: findEvent(id) }];
});

// ---------------------------------------------------------------------------
// BOOKING — vé của tôi
// ---------------------------------------------------------------------------
mock.onGet(/\/booking\/user\/tickets/).reply(200, {
  tickets: ALL_EVENTS.slice(0, 3).map((e, idx) => ({
    eventId: e._id,
    eventName: e.eventName,
    ticketName: idx % 2 === 0 ? "Vé Thường" : "Vé VIP",
    ticketPrice: e.lowestPrice,
    quantity: 1 + (idx % 2),
    status: "Đã thanh toán",
    purchaseDate: new Date().toISOString(),
  })),
});

mock.onGet(/\/seats\/[^/?]+$/).reply((config) => {
  const id = config.url.split("/").pop();
  return [200, { success: true, event: findEvent(id) }];
});

mock.onPost(/\/booking\/create-payment-intent/).reply(200, {
  success: true,
  clientSecret: "mock_client_secret_test",
  order: { _id: "mock_order_123", totalAmount: 500000 },
  orderItems: [{ ticketName: "Vé Thường", quantity: 1, ticketPrice: 500000 }],
});

mock.onGet(/\/booking\/orders\/auth\//).reply(200, {
  success: true,
  status: "CONFIRMED",
});

// ---------------------------------------------------------------------------
// Mọi request khác không được mock ở trên -> trả lỗi 404 nhẹ nhàng thay vì
// timeout, để không phá layout (component nào cũng có catch(err) sẵn).
// ---------------------------------------------------------------------------
mock.onAny().reply(404, { success: false, message: "Mock: endpoint chưa được giả lập" });

console.info(
  "%c[Ticketerra] Đang chạy ở chế độ MOCK DATA — không cần backend thật.",
  "color:#8b5cf6;font-weight:bold;",
);
