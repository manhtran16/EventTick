/**
 * Seed script for TicketBox / EventTick database
 * Populates Categories, Users, Events, Zones, and Vouchers according to DATABASE.md
 * Run: npm run seed
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const connectDB = require("../config/db");
const { User, Category, Event, Zone, Voucher, Booking, Ticket, Payment, Review } = require("../models");

const usersData = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/users.json"), "utf-8"));
const eventsData = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/events.json"), "utf-8"));

function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveSessionTime(session) {
  const eventDate = new Date();
  eventDate.setHours(0, 0, 0, 0);
  eventDate.setDate(eventDate.getDate() + (session.daysFromNow ?? 0));

  const startTime = new Date(eventDate);
  startTime.setHours(session.startHour ?? 19, 0, 0, 0);

  const endTime = new Date(startTime);
  endTime.setHours(endTime.getHours() + 3);

  return { eventDate, startTime, endTime };
}

async function run() {
  await connectDB();

  // --- 1. Categories ---
  console.log("\n📁 Khởi tạo Categories...");
  const categoriesDef = [
    { name: "Nhạc sống & Concert", slug: "nhac-song-concert", description: "Các đêm nhạc, liveshow ca sĩ và đại nhạc hội" },
    { name: "Hội thảo & Workshop", slug: "hoi-thao-workshop", description: "Các buổi chia sẻ kiến thức, kỹ năng và kết nối doanh nghiệp" },
    { name: "Thể Thao", slug: "the-thao", description: "Các giải chạy, giải đấu bóng đá, tennis và thể thao ngoài trời" },
    { name: "Sân khấu & Nghệ thuật", slug: "san-khau-nghe-thuat", description: "Kịch nói, múa kịch, triển lãm tranh và nghệ thuật thị giác" },
    { name: "Khác", slug: "khac", description: "Các sự kiện cộng đồng khác" },
  ];

  const categoryMap = {};
  for (const cat of categoriesDef) {
    const createdCat = await Category.findOneAndUpdate(
      { slug: cat.slug },
      cat,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    categoryMap[cat.name] = createdCat;
  }
  console.log(`   ✓ Đã tạo ${categoriesDef.length} danh mục sự kiện.`);

  // --- 2. Users ---
  console.log(`\n👤 Import ${usersData.length} user(s)...`);
  const usersByUsername = {};

  for (const u of usersData) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await User.findOneAndUpdate(
      { email: u.email },
      {
        username: u.username,
        email: u.email,
        passwordHash,
        role: u.role || "CUSTOMER",
        fullName: u.name,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        gender: u.gender,
        isEmailVerified: true,
        isActive: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    usersByUsername[user.username] = user;
    console.log(`   ✓ ${user.username} (Role: ${user.role}, Pass: ${u.password})`);
  }

  // --- 3. Dọn dẹp dữ liệu cũ ---
  console.log("\n🧹 Xoá dữ liệu cũ của Event, Zone, Booking, Ticket, Payment, Review, Voucher...");
  await Event.deleteMany({});
  await Zone.deleteMany({});
  await Booking.deleteMany({});
  await Ticket.deleteMany({});
  await Payment.deleteMany({});
  await Review.deleteMany({});
  await Voucher.deleteMany({});

  // --- 4. Events & Zones ---
  console.log(`\n🎫 Import ${eventsData.length} sự kiện và tạo Zone cho từng suất diễn...`);
  for (const e of eventsData) {
    const owner = usersByUsername[e.ownerUsername] || Object.values(usersByUsername)[0];
    const cat = categoryMap[e.category] || categoryMap["Khác"];

    const sessionsToCreate = (e.sessions || []).map((s, idx) => {
      const { eventDate, startTime, endTime } = resolveSessionTime(s);
      return {
        name: s.name || `Buổi diễn ${idx + 1}`,
        eventDate,
        startTime,
        endTime,
      };
    });

    const baseSlug = slugify(e.eventName);
    const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`;

    const event = await Event.create({
      organizerId: owner._id,
      categoryId: cat._id,
      category: e.category,
      title: e.eventName,
      slug: uniqueSlug,
      description: e.eventDesc,
      organizerInfo: e.organizerInfo,
      organizerName: "Demo Organizer Co.",
      location: e.venueName,
      bannerUrl: e.backgroundImage,
      thumbnailUrl: e.backgroundImage,
      isSpecial: !!e.isSpecial,
      isTrending: !!e.isTrending,
      status: "APPROVED",
      sessions: sessionsToCreate,
    });

    // Tạo Zone cho từng Session
    let lowestPrice = Infinity;
    const zonesToInsert = [];

    (e.sessions || []).forEach((rawSession, sIdx) => {
      const createdSession = event.sessions[sIdx];
      (rawSession.tickets || []).forEach((t) => {
        const price = Number(t.price) || 0;
        const stock = Number(t.stock) || 50;
        if (price < lowestPrice) lowestPrice = price;

        zonesToInsert.push({
          eventId: event._id,
          sessionId: createdSession._id,
          name: t.name,
          price,
          totalCapacity: stock,
          availableCapacity: stock,
          maxPerOrder: 10,
          description: t.desc || `Vé hạng ${t.name}`,
        });
      });
    });

    if (zonesToInsert.length > 0) {
      await Zone.insertMany(zonesToInsert);
    }

    event.lowestPrice = lowestPrice === Infinity ? 0 : lowestPrice;
    await event.save();
    console.log(`   ✓ Sự kiện: "${event.title}" (${zonesToInsert.length} hạng vé Zone)`);
  }

  // --- 5. Vouchers ---
  console.log("\n🏷️ Tạo Vouchers mẫu...");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 ngày tới

  const sampleVouchers = [
    {
      code: "CHAOHEXUAN2026",
      discountType: "PERCENT",
      discountValue: 20, // 20%
      maxDiscountAmount: 50000, // Tối đa giảm 50.000đ (anti-fraud)
      minOrderValue: 100000,
      maxUsage: 100,
      maxUsagePerUser: 1,
      expiresAt,
      isActive: true,
    },
    {
      code: "GIAM50K",
      discountType: "FIXED",
      discountValue: 50000, // Giảm 50.000đ
      minOrderValue: 200000,
      maxUsage: 50,
      maxUsagePerUser: 2,
      expiresAt,
      isActive: true,
    },
  ];

  await Voucher.insertMany(sampleVouchers);
  for (const v of sampleVouchers) {
    console.log(`   ✓ Voucher: ${v.code} (${v.discountType === "PERCENT" ? `${v.discountValue}% tối đa ${v.maxDiscountAmount?.toLocaleString()}đ` : `${v.discountValue.toLocaleString()}đ`})`);
  }

  console.log("\n========================================================");
  console.log("✅ Seed dữ liệu thành công theo đặc tả DATABASE.md!");
  console.log("========================================================\n");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Lỗi khi import dữ liệu:", err);
  process.exit(1);
});
