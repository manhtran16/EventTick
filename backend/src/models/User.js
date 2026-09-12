const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin", "both"], default: "user" },

    // thông tin hồ sơ, cập nhật ở AccountPage.jsx
    name: String,
    phone: String,
    dob: Date,
    gender: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
