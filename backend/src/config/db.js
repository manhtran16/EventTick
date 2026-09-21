const mongoose = require("mongoose");

/**
 * Kết nối tới MongoDB. Toàn bộ dự án chỉ dùng 1 database MongoDB duy nhất,
 * không cần MySQL/Redis/RabbitMQ như bản gốc.
 */
module.exports = async function connectDB() {
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    "mongodb://localhost:27017/ticketerra_simple";
  try {
    await mongoose.connect(uri);
    console.log("✅ Đã kết nối MongoDB:", uri);
  } catch (err) {
    console.error("❌ Lỗi kết nối MongoDB:", err.message);
    console.error("   -> Kiểm tra lại MONGODB_URI trong file .env và đảm bảo MongoDB đang chạy.");
    process.exit(1);
  }
};
