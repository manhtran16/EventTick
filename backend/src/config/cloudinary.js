const cloudinary = require("cloudinary").v2;

// Tự động loại bỏ dấu chấm phẩy (;), khoảng trắng hoặc dấu nháy thừa nếu người dùng vô tình gõ vào file .env
const clean = (val) => (val ? String(val).trim().replace(/[;'"]/g, "") : "");

const cloudName = clean(process.env.CLOUDINARY_CLOUD_NAME);
const apiKey = clean(process.env.CLOUDINARY_API_KEY);
const apiSecret = clean(process.env.CLOUDINARY_API_SECRET);

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

const isCloudinaryConfigured = () => {
  return Boolean(cloudName && apiKey && apiSecret);
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
};
