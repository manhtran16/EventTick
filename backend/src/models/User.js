const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      trim: true,
      default: function () {
        if (this.firstName || this.lastName) {
          return `${this.lastName || ""} ${this.firstName || ""}`.trim();
        }
        return this.username || "";
      },
    },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    username: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    phone: { type: String, trim: true },
    avatarUrl: { type: String },
    gender: { type: String },
    dob: { type: Date },

    // Role: CUSTOMER (all users can book and create events), STAFF (scan QR tickets), ADMIN (approve events, vouchers)
    // Backward compat: "user" -> "CUSTOMER", "admin" -> "ADMIN"
    role: {
      type: String,
      enum: ["CUSTOMER", "STAFF", "ADMIN", "user", "admin", "both"],
      default: "CUSTOMER",
    },

    // UC 1.2: Email verification
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },

    // UC 1.4 & 1.5: Forgot & reset password
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },

    // Account active flag
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual alias 'name' -> fullName for backward compatibility
userSchema.virtual("name").get(function () {
  return this.fullName || `${this.lastName || ""} ${this.firstName || ""}`.trim();
});

// Auto-fill fullName if name or firstName/lastName are provided
userSchema.pre("save", function (next) {
  if (!this.fullName && (this.firstName || this.lastName)) {
    this.fullName = `${this.lastName || ""} ${this.firstName || ""}`.trim();
  }
  // Normalize roles
  if (this.role === "user") this.role = "CUSTOMER";
  if (this.role === "admin") this.role = "ADMIN";
  next();
});

module.exports = mongoose.model("User", userSchema);
