/**
 * Đọc dữ liệu mẫu từ src/data/users.json và src/data/events.json rồi import
 * vào MongoDB THÔNG QUA Mongoose (để các hook như hash mật khẩu, tính
 * lowestPrice/earliestDate/lastDate của Event chạy đúng, giống hệt khi
 * dữ liệu được tạo qua API thật).
 *
 * Muốn thêm/sửa dữ liệu mẫu: chỉ cần sửa 2 file JSON trong src/data/,
 * KHÔNG cần sửa file .js này.
 *
 * Chạy: npm run seed
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const connectDB = require("../config/db");
const User = require("../models/User");
const Event = require("../models/Event");

const usersData = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/users.json"), "utf-8"));
const eventsData = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/events.json"), "utf-8"));

// Chuyển { daysFromNow, startHour } thành 2 mốc thời gian thật (Date)
function resolveSessionTime(session) {
  const eventDate = new Date();
  eventDate.setHours(0, 0, 0, 0);
  eventDate.setDate(eventDate.getDate() + (session.daysFromNow ?? 0));

  const startTime = new Date(eventDate);
  startTime.setHours(session.startHour ?? 19, 0, 0, 0);

  return { eventDate, startTime };
}

async function run() {
  await connectDB();

  // --- Users ---
  console.log(`\n👤 Import ${usersData.length} user(s)...`);
  const usersByUsername = {};

  for (const u of usersData) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    // upsert: chạy lại nhiều lần không bị lỗi trùng username/email
    const user = await User.findOneAndUpdate(
      { username: u.username },
      {
        username: u.username,
        email: u.email,
        passwordHash,
        role: u.role || "user",
        name: u.name,
        phone: u.phone,
        gender: u.gender,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    usersByUsername[user.username] = user;
    console.log(`   ✓ ${user.username} (mật khẩu: ${u.password})`);
  }

  // --- Events ---
  console.log(`\n🎫 Xoá sự kiện cũ và import ${eventsData.length} sự kiện mới...`);
  await Event.deleteMany({});

  for (const e of eventsData) {
    const owner = usersByUsername[e.ownerUsername];
    if (!owner) {
      console.warn(`   ⚠ Bỏ qua "${e.eventName}" vì không tìm thấy user "${e.ownerUsername}"`);
      continue;
    }

    await Event.create({
      eventName: e.eventName,
      eventDesc: e.eventDesc,
      organizerInfo: e.organizerInfo,
      venueName: e.venueName,
      category: e.category,
      backgroundImage: e.backgroundImage,
      ownerId: owner._id,
      isSpecial: !!e.isSpecial,
      isTrending: !!e.isTrending,
      sessions: (e.sessions || []).map((s) => {
        const { eventDate, startTime } = resolveSessionTime(s);
        return {
          eventDate,
          startTime,
          tickets: (s.tickets || []).map((t) => ({
            name: t.name,
            price: t.price,
            stock: t.stock,
            remaining: t.stock,
            sold: 0,
          })),
        };
      }),
    });
    console.log(`   ✓ ${e.eventName}`);
  }

  console.log("\n✅ Import xong. Chạy `npm run dev` rồi mở front-end để xem dữ liệu.\n");
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Lỗi khi import dữ liệu:", err);
  process.exit(1);
});
