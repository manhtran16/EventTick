/**
 * Seed dữ liệu mẫu cho database EventTick (schema theo eventtick_database_specification.md).
 * Chạy: npm run seed   (tự tạo collection + validator + index trước khi nạp dữ liệu)
 *
 * CẢNH BÁO: xoá sạch dữ liệu nghiệp vụ (events, tiers, orders, tickets...) trước khi nạp lại.
 * Users/categories được upsert theo email/slug.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

// Câu hỏi mẫu của BTC, để test bước "Thông tin đặt vé" trước thanh toán.
const DEMO_FORM = [
  { key: "full_name", label: "Họ tên người tham dự", type: "text", required: true },
  { key: "phone", label: "Số điện thoại liên hệ", type: "text", required: true },
  { key: "tshirt", label: "Size áo", type: "select", required: false, options: ["S", "M", "L", "XL"] },
];

const connectDB = require("../config/db");
const initDatabase = require("../db/initDatabase");
const M = require("../models");
const { signTicket } = require("../services/bookingService");
const { seatsOfSection } = require("./seatGrid");
const { SAMPLE_SVG } = require("./seatmapTemplate");

const usersData = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/users.json"), "utf-8"));
const eventsData = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/events.json"), "utf-8"));

// Tên thành phố suy ra từ venueName ("..., TP. Hồ Chí Minh" -> "TP. Hồ Chí Minh")
const cityOf = (venue) => (venue.includes(",") ? venue.split(",").pop().trim() : "Chưa rõ");

function resolveTimes(session) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + (session.daysFromNow ?? 0));
  start.setHours(session.startHour ?? 19, 0, 0, 0);
  const end = new Date(start.getTime() + 3 * 3600 * 1000);
  return { start, end };
}

async function run() {
  await connectDB();
  await initDatabase();

  // --- Xoá dữ liệu nghiệp vụ cũ ---
  console.log("\nXoá dữ liệu nghiệp vụ cũ...");
  for (const name of [
    "PayoutSettlement", "RefundRequest", "ResaleListing",
    "Ticket", "Payment", "Order", "Voucher", "Seat", "SeatmapLayout", "TicketTier", "EventSession", "EContract", "StaffAssignment", "Event",
    "OrganizerProfile",
  ]) {
    await M[name].deleteMany({});
  }

  // --- Categories ---
  const categoriesDef = [
    { name: "Nhạc sống & Concert", slug: "nhac-song-concert" },
    { name: "Hội thảo & Workshop", slug: "hoi-thao-workshop" },
    { name: "Thể Thao", slug: "the-thao" },
    { name: "Sân khấu & Nghệ thuật", slug: "san-khau-nghe-thuat" },
    { name: "Khác", slug: "khac" },
  ];
  const categoryByName = {};
  for (const c of categoriesDef) {
    categoryByName[c.name] = await M.Category.findOneAndUpdate(
      { slug: c.slug },
      { ...c, is_active: true },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  console.log(`Categories: ${categoriesDef.length}`);

  // --- Users ---
  const userByName = {};
  for (const u of usersData) {
    userByName[u.username] = await M.User.findOneAndUpdate(
      { email: u.email },
      {
        username: u.username,
        email: u.email,
        password_hash: await bcrypt.hash(u.password, 10),
        full_name: u.name,
        first_name: u.firstName,
        last_name: u.lastName,
        phone: u.phone,
        gender: u.gender,
        role: u.role,
        status: "ACTIVE",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    console.log(`  user ${u.username} (${u.role}) / mật khẩu: ${u.password}`);
  }
  const admin = userByName.demo_admin;
  const organizer = userByName.demo_organizer;
  const staff = userByName.demo_staff;
  const customer = userByName.demo_user;

  // --- Organizer profile (KYC đã duyệt) ---
  await M.OrganizerProfile.create({
    user_id: organizer._id,
    organization_name: "Demo Concert Co., Ltd.",
    business_type: "ENTERPRISE",
    tax_code: "0312345678",
    id_card_or_license_url: "https://picsum.photos/seed/license/600/400",
    bank_name: "Vietcombank",
    bank_account_no: "0123456789",
    bank_account_holder: "CONG TY TNHH DEMO CONCERT",
    kyc_status: "VERIFIED",
    verified_by: admin._id,
    verified_at: new Date(),
  });

  // --- Events + ticket tiers + contracts + staff ---
  const events = [];
  const sessionsByEvent = {};
  const tiersByEvent = {};
  for (const [eIdx, e] of eventsData.entries()) {
    const rawSessions = [...(e.sessions || [])];
    // Demo nhiều suất: sự kiện đầu tiên có thêm suất thứ 2 (sau 1 ngày) với cùng hạng vé
    if (eIdx === 0 && rawSessions.length === 1) {
      rawSessions.push({ ...rawSessions[0], daysFromNow: (rawSessions[0].daysFromNow ?? 0) + 1 });
    }
    const times = rawSessions.map(resolveTimes);
    const start = new Date(Math.min(...times.map((t) => t.start)));
    const end = new Date(Math.max(...times.map((t) => t.end)));

    const rawTiers = rawSessions.flatMap((s) => s.tickets || []);
    const event = await M.Event.create({
      organizer_id: organizer._id,
      category_id: (categoryByName[e.category] || categoryByName["Khác"])._id,
      title: e.eventName,
      description: e.eventDesc,
      banner_url: e.backgroundImage,
      thumbnail_url: e.backgroundImage,
      venue_name: e.venueName,
      city: cityOf(e.venueName),
      start_time: start,
      end_time: end,
      has_seat_map: false,
      allow_resale: true,
      max_resale_markup_pct: 10,
      status: "PUBLISHED",
      is_featured_banner: !!e.isSpecial,
      is_special: !!e.isSpecial,
      is_trending: !!e.isTrending,
      organizer_name: "Demo Concert Co., Ltd.",
      organizer_info: e.organizerInfo,
      lowest_price: Math.min(...rawTiers.map((t) => Number(t.price) || 0)),
    });

    const sessions = await M.EventSession.insertMany(
      times.map((t, i) => ({
        event_id: event._id,
        name: rawSessions[i].name || `Suất diễn ${i + 1}`,
        start_time: t.start,
        end_time: t.end,
        status: "SCHEDULED",
      })),
    );

    const tierDocs = [];
    rawSessions.forEach((rs, si) => {
      (rs.tickets || []).forEach((t, i) => {
        tierDocs.push({
          event_id: event._id,
          session_id: sessions[si]._id,
          name: t.name,
          price: Number(t.price) || 0,
          total_quantity: Number(t.stock) || 50,
          available_quantity: Number(t.stock) || 50,
          zone_type: "GA",
          min_per_order: 1,
          max_per_order: 4,
          sale_start_time: new Date(Date.now() - 24 * 3600 * 1000),
          sale_end_time: times[si].start,
          zone_color: ["#22c55e", "#f59e0b", "#ef4444", "#3b82f6"][i % 4],
          description: t.desc || `Vé hạng ${t.name}`,
        });
      });
    });
    const tiers = await M.TicketTier.insertMany(tierDocs);

    await M.EContract.create({
      event_id: event._id,
      organizer_id: organizer._id,
      approved_by_admin: admin._id,
      commission_rate_pct: 5,
      contract_terms_html: "<h3>Hợp đồng dịch vụ bán vé</h3><p>Sàn thu phí hoa hồng 5% trên doanh thu bán vé.</p>",
      signed_at: new Date(),
      signer_ip: "127.0.0.1",
      status: "SIGNED",
    });
    await M.StaffAssignment.create({
      staff_user_id: staff._id,
      organizer_id: organizer._id,
      event_id: event._id,
      assigned_gate: "Gate A",
      is_active: true,
    });

    events.push(event);
    sessionsByEvent[event._id] = sessions;
    tiersByEvent[event._id] = tiers;
    console.log(`  event "${event.title}" (${sessions.length} suất, ${tiers.length} hạng vé)`);
  }

  // --- Các sự kiện có SƠ ĐỒ GHẾ (Seatmap Layout) đa dạng mô hình ---
  const seedSeatmapEvent = async ({
    category,
    title,
    description,
    banner_url,
    venue_name,
    city,
    startDays = 15,
    svg_content,
    stage_ids = ["STAGE_MAIN"],
    tiersDef,
    sectionsDef,
  }) => {
    const start = new Date(Date.now() + startDays * 24 * 3600 * 1000);
    start.setHours(19, 30, 0, 0);
    const end = new Date(start.getTime() + 3.5 * 3600 * 1000);

    const capacityByTier = {};
    for (const s of sectionsDef) {
      capacityByTier[s.tier_name] = (capacityByTier[s.tier_name] || 0) + s.capacity;
    }

    const event = await M.Event.create({
      organizer_id: organizer._id,
      category_id: category._id,
      title,
      description,
      banner_url,
      thumbnail_url: banner_url,
      venue_name,
      city,
      start_time: start,
      end_time: end,
      has_seat_map: true,
      allow_resale: true,
      max_resale_markup_pct: 10,
      status: "PUBLISHED",
      custom_form_schema: DEMO_FORM,
      organizer_name: "Demo Concert Co., Ltd.",
      lowest_price: Math.min(...tiersDef.map((t) => t.price)),
    });

    const session = await M.EventSession.create({
      event_id: event._id,
      name: "Đêm diễn chính",
      start_time: start,
      end_time: end,
      status: "SCHEDULED",
    });

    const tierDocs = tiersDef.map((t) => {
      const qty = capacityByTier[t.name] ?? t.total_quantity ?? 50;
      return {
        event_id: event._id,
        session_id: session._id,
        name: t.name,
        price: t.price,
        total_quantity: qty,
        available_quantity: qty,
        min_per_order: 1,
        max_per_order: 6,
        zone_type: t.zone_type || "SEATED",
        sale_start_time: new Date(Date.now() - 24 * 3600 * 1000),
        sale_end_time: start,
        zone_color: t.zone_color,
      };
    });
    const createdTiers = await M.TicketTier.insertMany(tierDocs);
    const tierMap = new Map(createdTiers.map((t) => [t.name, t]));

    const seatDocs = [];
    for (const sec of sectionsDef) {
      if (sec.type !== "SEATED") continue;
      const tier = tierMap.get(sec.tier_name);
      for (const p of seatsOfSection(sec)) {
        seatDocs.push({
          event_id: event._id,
          session_id: session._id,
          tier_id: tier._id,
          section_name: sec.section_id,
          row_label: p.row,
          seat_number: String(p.number).padStart(2, "0"),
          coord_x: p.x,
          coord_y: p.y,
          status: "AVAILABLE",
        });
      }
    }

    if (seatDocs.length) {
      await M.Seat.insertMany(seatDocs);
    }

    await M.SeatmapLayout.create({
      event_id: event._id,
      svg_content,
      stage_ids,
      sections: sectionsDef,
      updated_by: admin._id,
    });

    await M.EContract.create({
      event_id: event._id,
      organizer_id: organizer._id,
      approved_by_admin: admin._id,
      commission_rate_pct: 5,
      contract_terms_html: "<p>Hợp đồng dịch vụ bán vé điện tử</p>",
      signed_at: new Date(),
      signer_ip: "127.0.0.1",
      status: "SIGNED",
    });

    await M.StaffAssignment.create({
      staff_user_id: staff._id,
      organizer_id: organizer._id,
      event_id: event._id,
      assigned_gate: "Gate A",
      is_active: true,
    });

    console.log(`  event có sơ đồ ghế: "${event.title}" (${seatDocs.length} ghế ngồi, ${sectionsDef.length} khu)`);
    return { event, session, tiers: createdTiers };
  };

  // 1. Sơ đồ Nhà Hát Lớn (Test chuẩn chọn ghế/khóa ghế Redis UC11, UC12)
  const mkSimpleRows = (labels) => labels.map((label) => ({ label, from: 1, to: 10, aisles: [], blocked: [] }));
  await seedSeatmapEvent({
    category: categoryByName["Sân khấu & Nghệ thuật"],
    title: "Vở Kịch Có Ghế Ngồi - Đêm Diễn Đặc Biệt",
    description: "<p>Sự kiện kịch nghệ với sơ đồ ghế tiêu chuẩn hai khu VIP và Thường.</p>",
    banner_url: "https://images.unsplash.com/photo-1503095396549-807759245b35?q=80&w=1200&auto=format&fit=crop",
    venue_name: "Nhà Hát Lớn, Hà Nội",
    city: "Hà Nội",
    startDays: 20,
    svg_content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360"><rect id="STAGE_MAIN" x="150" y="10" width="300" height="50" rx="8"/><text x="300" y="42" text-anchor="middle" fill="#fff" font-size="20" font-family="sans-serif">SÂN KHẤU</text><rect id="SEC_VIP" x="100" y="90" width="400" height="90" rx="10"/><rect id="SEC_STD" x="60" y="210" width="480" height="130" rx="10"/></svg>',
    stage_ids: ["STAGE_MAIN"],
    tiersDef: [
      { name: "Ghế VIP", price: 500000, zone_color: "#f59e0b", zone_type: "SEATED" },
      { name: "Ghế Thường", price: 200000, zone_color: "#3b82f6", zone_type: "SEATED" },
    ],
    sectionsDef: [
      { section_id: "SEC_VIP", name: "Khu VIP", type: "SEATED", tier_name: "Ghế VIP", layout: "STRAIGHT", capacity: 20, rows: mkSimpleRows(["A", "B"]) },
      { section_id: "SEC_STD", name: "Khu Thường", type: "SEATED", tier_name: "Ghế Thường", layout: "STRAIGHT", capacity: 30, rows: mkSimpleRows(["C", "D", "E"]) },
    ],
  });

  // 2. Đại Nhạc Hội Sân Vận Động (Layout ARC quạt cong quanh sân khấu + Khu đứng GA)
  await seedSeatmapEvent({
    category: categoryByName["Nhạc sống & Concert"],
    title: "Symphony of Stars - Super Arena Concert 2026",
    description: "<p>Đại nhạc hội quy mô lớn với sân khấu bán nguyệt, các khu ghế cánh cung bao quanh và khu đứng GA cuồng nhiệt.</p>",
    banner_url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop",
    venue_name: "Sân Vận Động Quốc Gia Mỹ Đình, Hà Nội",
    city: "Hà Nội",
    startDays: 25,
    svg_content: SAMPLE_SVG,
    stage_ids: ["STAGE_MAIN"],
    tiersDef: [
      { name: "VIP", price: 1800000, zone_color: "#f59e0b", zone_type: "SEATED" },
      { name: "CAT 1", price: 900000, zone_color: "#3b82f6", zone_type: "SEATED" },
      { name: "GA", price: 450000, zone_color: "#22c55e", zone_type: "GA" },
    ],
    sectionsDef: [
      {
        section_id: "SEC_VIP_L", name: "VIP Trái", type: "SEATED", tier_name: "VIP", layout: "ARC", capacity: 38,
        rows: [
          { label: "A", from: 1, to: 10, aisles: [], blocked: [1, 10] },
          { label: "B", from: 1, to: 10, aisles: [], blocked: [] },
          { label: "C", from: 1, to: 10, aisles: [], blocked: [] },
          { label: "D", from: 1, to: 10, aisles: [], blocked: [] },
        ],
      },
      {
        section_id: "SEC_VIP_R", name: "VIP Phải", type: "SEATED", tier_name: "VIP", layout: "ARC", capacity: 38,
        rows: [
          { label: "A", from: 1, to: 10, aisles: [], blocked: [1, 10] },
          { label: "B", from: 1, to: 10, aisles: [], blocked: [] },
          { label: "C", from: 1, to: 10, aisles: [], blocked: [] },
          { label: "D", from: 1, to: 10, aisles: [], blocked: [] },
        ],
      },
      {
        section_id: "SEC_CAT1_L", name: "CAT 1 Trái", type: "SEATED", tier_name: "CAT 1", layout: "ARC", capacity: 70,
        rows: [
          { label: "A", from: 1, to: 14, aisles: [7], blocked: [] },
          { label: "B", from: 1, to: 14, aisles: [7], blocked: [] },
          { label: "C", from: 1, to: 14, aisles: [7], blocked: [] },
          { label: "D", from: 1, to: 14, aisles: [7], blocked: [] },
          { label: "E", from: 1, to: 14, aisles: [7], blocked: [] },
        ],
      },
      {
        section_id: "SEC_CAT1_R", name: "CAT 1 Phải", type: "SEATED", tier_name: "CAT 1", layout: "ARC", capacity: 70,
        rows: [
          { label: "A", from: 1, to: 14, aisles: [7], blocked: [] },
          { label: "B", from: 1, to: 14, aisles: [7], blocked: [] },
          { label: "C", from: 1, to: 14, aisles: [7], blocked: [] },
          { label: "D", from: 1, to: 14, aisles: [7], blocked: [] },
          { label: "E", from: 1, to: 14, aisles: [7], blocked: [] },
        ],
      },
      {
        section_id: "SEC_GA", name: "Khu Đứng GA", type: "GA", tier_name: "GA", layout: "STRAIGHT", capacity: 500, rows: [],
      },
    ],
  });

  // 3. Khán Phòng Hội Thảo & Nhà Hát 3 Cánh (Auditorium: Cánh Trái, VIP Trung Tâm, Cánh Phải, Tầng Lửng)
  const AUDITORIUM_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 520">' +
    '<rect id="STAGE_MAIN" x="250" y="20" width="400" height="55" rx="8" fill="#9ca3af"/>' +
    '<text x="450" y="55" text-anchor="middle" fill="#fff" font-size="20" font-family="sans-serif">SÂN KHẤU CHÍNH</text>' +
    '<rect id="SEC_CENTER" x="270" y="105" width="360" height="180" rx="10"/>' +
    '<rect id="SEC_WING_L" x="40" y="115" width="200" height="160" rx="10"/>' +
    '<rect id="SEC_WING_R" x="660" y="115" width="200" height="160" rx="10"/>' +
    '<rect id="SEC_BALCONY" x="120" y="315" width="660" height="170" rx="10"/>' +
    '</svg>';

  await seedSeatmapEvent({
    category: categoryByName["Hội thảo & Workshop"],
    title: "Tech Summit Vietnam 2026 - Đỉnh Cao Trí Tuệ Nhân Tạo",
    description: "<p>Hội thảo công nghệ quy mô quốc tế với khán phòng hiện đại chia 3 phân khu cánh và tầng lửng sang trọng.</p>",
    banner_url: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1200&auto=format&fit=crop",
    venue_name: "Trung Tâm Hội Nghị Quốc Gia, Hà Nội",
    city: "Hà Nội",
    startDays: 18,
    svg_content: AUDITORIUM_SVG,
    stage_ids: ["STAGE_MAIN"],
    tiersDef: [
      { name: "VIP Trung Tâm", price: 1500000, zone_color: "#ef4444", zone_type: "SEATED" },
      { name: "Ghế Tiêu Chuẩn", price: 750000, zone_color: "#3b82f6", zone_type: "SEATED" },
      { name: "Ghế Tầng Lửng", price: 400000, zone_color: "#10b981", zone_type: "SEATED" },
    ],
    sectionsDef: [
      {
        section_id: "SEC_CENTER", name: "VIP Trung Tâm", type: "SEATED", tier_name: "VIP Trung Tâm", layout: "STRAIGHT", capacity: 40,
        rows: [
          { label: "A", from: 1, to: 8, aisles: [4], blocked: [] },
          { label: "B", from: 1, to: 8, aisles: [4], blocked: [] },
          { label: "C", from: 1, to: 8, aisles: [4], blocked: [] },
          { label: "D", from: 1, to: 8, aisles: [4], blocked: [] },
          { label: "E", from: 1, to: 8, aisles: [4], blocked: [] },
        ],
      },
      {
        section_id: "SEC_WING_L", name: "Cánh Trái", type: "SEATED", tier_name: "Ghế Tiêu Chuẩn", layout: "STRAIGHT", capacity: 24,
        rows: [
          { label: "A", from: 1, to: 6, aisles: [], blocked: [] },
          { label: "B", from: 1, to: 6, aisles: [], blocked: [] },
          { label: "C", from: 1, to: 6, aisles: [], blocked: [] },
          { label: "D", from: 1, to: 6, aisles: [], blocked: [] },
        ],
      },
      {
        section_id: "SEC_WING_R", name: "Cánh Phải", type: "SEATED", tier_name: "Ghế Tiêu Chuẩn", layout: "STRAIGHT", capacity: 24,
        rows: [
          { label: "A", from: 1, to: 6, aisles: [], blocked: [] },
          { label: "B", from: 1, to: 6, aisles: [], blocked: [] },
          { label: "C", from: 1, to: 6, aisles: [], blocked: [] },
          { label: "D", from: 1, to: 6, aisles: [], blocked: [] },
        ],
      },
      {
        section_id: "SEC_BALCONY", name: "Tầng Lửng (Balcony)", type: "SEATED", tier_name: "Ghế Tầng Lửng", layout: "STRAIGHT", capacity: 36,
        rows: [
          { label: "A", from: 1, to: 12, aisles: [6], blocked: [] },
          { label: "B", from: 1, to: 12, aisles: [6], blocked: [] },
          { label: "C", from: 1, to: 12, aisles: [6], blocked: [] },
        ],
      },
    ],
  });

  // 4. Phòng Trà Ca Nhạc Ấm Cúng (Sofa VIP Cận Cảnh + Bàn Tiêu Chuẩn + Quầy Bar)
  const LOUNGE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 420">' +
    '<rect id="STAGE_MAIN" x="220" y="15" width="260" height="50" rx="8" fill="#9ca3af"/>' +
    '<text x="350" y="47" text-anchor="middle" fill="#fff" font-size="18" font-family="sans-serif">SÂN KHẤU LIVE</text>' +
    '<rect id="SEC_SOFA" x="120" y="85" width="460" height="90" rx="10"/>' +
    '<rect id="SEC_TABLE" x="80" y="195" width="540" height="110" rx="10"/>' +
    '<rect id="SEC_BAR" x="160" y="325" width="380" height="75" rx="8"/>' +
    '</svg>';

  await seedSeatmapEvent({
    category: categoryByName["Nhạc sống & Concert"],
    title: "Đêm Nhạc Acoustic & Jazz - Mây Trịnh Ca Sài Gòn",
    description: "<p>Không gian âm nhạc phòng trà mộc mạc, gần gũi với bàn Sofa VIP cận cảnh sân khấu và quầy bar cocktail.</p>",
    banner_url: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1200&auto=format&fit=crop",
    venue_name: "Phòng Trà Không Tên, TP. Hồ Chí Minh",
    city: "TP. Hồ Chí Minh",
    startDays: 12,
    svg_content: LOUNGE_SVG,
    stage_ids: ["STAGE_MAIN"],
    tiersDef: [
      { name: "Sofa VIP", price: 800000, zone_color: "#ec4899", zone_type: "SEATED" },
      { name: "Bàn Tiêu Chuẩn", price: 450000, zone_color: "#8b5cf6", zone_type: "SEATED" },
      { name: "Ghế Bar High-Chair", price: 250000, zone_color: "#06b6d4", zone_type: "SEATED" },
    ],
    sectionsDef: [
      {
        section_id: "SEC_SOFA", name: "Khu Sofa Cận Cảnh", type: "SEATED", tier_name: "Sofa VIP", layout: "STRAIGHT", capacity: 16,
        rows: [
          { label: "A", from: 1, to: 8, aisles: [], blocked: [] },
          { label: "B", from: 1, to: 8, aisles: [], blocked: [] },
        ],
      },
      {
        section_id: "SEC_TABLE", name: "Khu Bàn Tiêu Chuẩn", type: "SEATED", tier_name: "Bàn Tiêu Chuẩn", layout: "STRAIGHT", capacity: 30,
        rows: [
          { label: "C", from: 1, to: 10, aisles: [5], blocked: [] },
          { label: "D", from: 1, to: 10, aisles: [5], blocked: [] },
          { label: "E", from: 1, to: 10, aisles: [5], blocked: [] },
        ],
      },
      {
        section_id: "SEC_BAR", name: "Khu Quầy Bar Cocktail", type: "SEATED", tier_name: "Ghế Bar High-Chair", layout: "STRAIGHT", capacity: 16,
        rows: [
          { label: "F", from: 1, to: 8, aisles: [], blocked: [] },
          { label: "G", from: 1, to: 8, aisles: [], blocked: [] },
        ],
      },
    ],
  });

  // --- Vouchers (theo từng sự kiện đầu tiên) ---
  const first = events[0];
  const validFrom = new Date(Date.now() - 24 * 3600 * 1000);
  const validUntil = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  await M.Voucher.insertMany([
    {
      event_id: first._id, code: "CHAOHEXUAN2026", discount_type: "PERCENT", discount_value: 20,
      max_discount_amount: 50000, min_order_amount: 100000, usage_limit: 100, max_per_user: 1,
      valid_from: validFrom, valid_until: validUntil,
    },
    {
      event_id: first._id, code: "GIAM50K", discount_type: "FIXED", discount_value: 50000,
      min_order_amount: 200000, usage_limit: 50, max_per_user: 2,
      valid_from: validFrom, valid_until: validUntil,
    },
  ]);
  console.log(`  vouchers: CHAOHEXUAN2026, GIAM50K (sự kiện "${first.title}")`);

  // --- 1 đơn hàng đã thanh toán + vé mẫu cho demo_user ---
  const session = sessionsByEvent[first._id][0];
  const tier = tiersByEvent[first._id].find((t) => t.session_id.equals(session._id));
  const qty = 2;
  await M.TicketTier.updateOne({ _id: tier._id }, { $inc: { available_quantity: -qty } });
  const order = await M.Order.create({
    buyer_id: customer._id,
    event_id: first._id,
    session_id: session._id,
    order_code: `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-SEED01`,
    order_type: "PRIMARY",
    items_snapshot: [{ tier_id: tier._id, tier_name: tier.name, unit_price: tier.price, quantity: qty, seat_ids: [] }],
    subtotal_amount: tier.price * qty,
    discount_amount: 0,
    total_amount: tier.price * qty,
    status: "PAID",
    lock_expires_at: new Date(),
  });
  await M.Payment.create({
    order_id: order._id,
    gateway: "VNPAY",
    transaction_ref: "TX-SEED-0001",
    amount: order.total_amount,
    status: "SUCCESS",
    paid_at: new Date(),
  });
  const ticketDocs = Array.from({ length: qty }, (_, i) => {
    const code = `TK-SEED-${i + 1}`;
    return {
      order_id: order._id, event_id: first._id, session_id: session._id, tier_id: tier._id, owner_id: customer._id,
      ticket_code: code, qr_hash_signature: signTicket(code), status: "VALID",
    };
  });
  await M.Ticket.insertMany(ticketDocs);
  console.log(`  order ${order.order_code} (PAID) + ${qty} vé: TK-SEED-1, TK-SEED-2`);

  console.log("\nSeed xong.");
  await mongoose.disconnect();
  require("../config/redis").redis.disconnect();
}

run().catch(async (err) => {
  console.error("Seed lỗi:", err);
  await mongoose.disconnect();
  require("../config/redis").redis.disconnect();
  process.exit(1);
});
