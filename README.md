# Ticketerra Simple — bản clone đơn giản hoá

Đây là bản kiến trúc **rút gọn** của dự án Ticketerra gốc, dùng cho mục đích học tập /
làm portfolio cá nhân. Thay vì 7 microservice + MySQL + MongoDB + Redis + RabbitMQ,
toàn bộ backend được gộp thành **1 monolith Express**, chỉ dùng **MongoDB/Mongoose**.

```
ticketerra-simple/
├── front-end/     # KHÔNG đổi gì so với bản gốc — vẫn gọi API ở http://localhost:3000/v1
└── backend/       # Backend mới, viết lại từ đầu, đơn giản hoá tối đa
```

## Vì sao front-end không cần sửa gì?

`front-end/src/lib/axios.js` đã có sẵn `baseURL = http://localhost:3000/v1`.
Backend mới **chủ động lắng nghe đúng cổng 3000** và mount toàn bộ route dưới
tiền tố `/v1` — nên chỉ cần chạy backend đúng port là front-end gọi được ngay,
không cần động vào file front-end nào.

## Cách chạy

### 1. Chuẩn bị MongoDB
Cài MongoDB local, hoặc chạy bằng Docker:
```bash
docker run -d -p 27017:27017 --name mongo mongo
```
Hoặc dùng MongoDB Atlas (free tier) và lấy connection string.

### 2. Chạy backend
```bash
cd backend
cp .env.example .env      # sửa MONGO_URI/JWT_SECRET_KEY nếu cần
npm install
npm run seed               # import dữ liệu mẫu từ src/data/*.json (6 sự kiện, 2 user)
npm run dev                 # chạy ở http://localhost:3000
```

Dữ liệu mẫu nằm ở `backend/src/data/users.json` và `backend/src/data/events.json` —
là file JSON đơn giản, dễ đọc/sửa. Muốn thêm/sửa sự kiện hay user, chỉ cần sửa
2 file này rồi chạy lại `npm run seed` (script sẽ xoá hết event cũ và import lại,
nhưng KHÔNG xoá user cũ — dùng upsert theo `username`).

Tài khoản mẫu sau khi seed:
| username | password | role |
|---|---|---|
| demo_organizer | 123456 | admin (chủ 6 sự kiện mẫu) |
| demo_user | 123456 | user |

### 3. Chạy front-end
```bash
cd front-end
echo "VITE_USE_MOCK=false" > .env   # TẮT mock data giả, dùng backend thật
npm install
npm run dev                          # chạy ở http://localhost:5173
```

Mở `http://localhost:5173` — giờ dữ liệu bạn thấy là dữ liệu THẬT lấy từ MongoDB
qua backend, không còn là dữ liệu giả nữa.

## Backend đã làm được gì

| Tính năng | Trạng thái |
|---|---|
| Đăng ký / đăng nhập / đăng xuất (JWT qua cookie httpOnly) | ✅ |
| Xem thông tin & cập nhật hồ sơ tài khoản | ✅ |
| Danh sách sự kiện: banner, trending, special, recommend, latest week/month | ✅ |
| Tìm kiếm sự kiện theo tên/danh mục | ✅ |
| Xem chi tiết 1 sự kiện (lịch diễn, loại vé) | ✅ |
| Tạo sự kiện mới (upload ảnh lưu local, nhiều suất diễn, nhiều loại vé) | ✅ |
| Xem "Sự kiện của tôi" | ✅ |
| Đặt vé với **trừ kho atomic** (chống bán trùng khi nhiều người đặt cùng lúc) | ✅ |
| Xem "Vé của tôi" | ✅ |
| Thanh toán qua Stripe/VNPay/MoMo thật | ❌ chưa làm — hiện demo coi như trả tiền thành công ngay |
| Sơ đồ chọn ghế theo thời gian thực (Socket.IO) | ❌ chưa làm — đây là tính năng phức tạp nhất của bản gốc, cần thiết kế riêng |
| Gửi email xác nhận (Nodemailer) | ❌ chưa làm — có thể thêm dễ dàng trong `bookingController.createBooking` sau khi tạo booking thành công |
| Cache (Redis) / hàng đợi (RabbitMQ) | Cố tình bỏ — không cần thiết ở quy mô này |

## Điểm kỹ thuật quan trọng nhất: chống bán trùng vé

Xem comment chi tiết trong `backend/src/controllers/bookingController.js`.
Tóm tắt: dùng `Event.updateOne()` với `$inc` + `arrayFilters` + điều kiện `$expr`
để kiểm tra "còn đủ vé" và trừ kho **trong cùng một lệnh atomic** — không bao giờ
tách thành 2 bước "đọc rồi ghi" (nguồn gốc phổ biến nhất của bug overbooking).

## Lưu ý quan trọng — đã được kiểm tra tới đâu

Mình đã kiểm tra: cú pháp toàn bộ file (`node --check`), cài đặt dependency thành
công, và chạy thử server thật (khởi động Express, wiring route) trong môi trường
sandbox. Môi trường này **không có quyền truy cập MongoDB thật** (mạng bị giới hạn
domain), nên phần logic truy vấn/update MongoDB (đặc biệt là đoạn `arrayFilters`
trong `bookingController.js`) **chưa được chạy thử với dữ liệu thật**. Cú pháp và
logic đã được viết đúng theo tài liệu MongoDB, nhưng bạn nên tự test kỹ luồng đặt
vé (đặc biệt là trường hợp đặt đồng thời/hết vé) khi có MongoDB thật trước khi
dùng cho việc gì quan trọng.

## Gợi ý bước tiếp theo

1. Test kỹ luồng tạo sự kiện → đặt vé → xem vé, sửa lỗi phát sinh (nếu có) khi
   chạy với MongoDB thật.
2. Thêm gửi email xác nhận qua Nodemailer sau khi đặt vé thành công.
3. Nối cổng thanh toán thật (Stripe/VNPay/MoMo) — nhớ đổi luồng thành
   `status: "pending"` → chờ webhook → `"paid"`, và hoàn kho nếu thanh toán thất bại.
4. Nếu muốn tính năng chọn ghế thời gian thực, có thể tham khảo lại
   `RealtimeEventDetails.jsx` (front-end) và bản gốc dùng Socket.IO — đây là phần
   phức tạp nhất, nên làm sau cùng khi các phần khác đã ổn định.
