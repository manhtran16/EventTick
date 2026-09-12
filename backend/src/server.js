require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const connectDB = require("./config/db");
const { attachUser } = require("./middleware/auth");
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const bookingRoutes = require("./routes/bookingRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

// Cho phép front-end (chạy ở localhost / 127.0.0.1 trên mọi cổng) gọi API kèm cookie
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Blocked by CORS: " + origin));
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Phục vụ ảnh sự kiện đã upload tại /uploads/<filename>
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Gắn req.user cho MỌI request (null nếu chưa đăng nhập)
app.use(attachUser);

// Toàn bộ route đặt dưới tiền tố /v1 để KHỚP với front-end/src/lib/axios.js
// (baseURL: http://localhost:3000/v1) — không cần sửa gì bên front-end.
const eventCtrl = require("./controllers/eventController");
app.use("/v1/auth", authRoutes);
app.use("/v1/events", eventRoutes);
app.use("/v1/booking", bookingRoutes);
app.get("/v1/seats/:id", eventCtrl.getById);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Không tìm thấy endpoint này" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: "Lỗi server nội bộ" });
});

app.listen(PORT, () => {
  console.log(`✅ Backend đang chạy tại http://localhost:${PORT}`);
});
