const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");

const isProduction = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
const CLIENT_URL = () => process.env.CLIENT_URL || "http://localhost:5173";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
const STATE_COOKIE = "g_oauth_state";
const STATE_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
  maxAge: 10 * 60 * 1000,
};

function configured() {
  return process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL;
}
function fail(res, code) {
  return res.redirect(`${CLIENT_URL()}/login?error=${encodeURIComponent(code)}`);
}

// GET /auth/google -> chuyển hướng sang Google
exports.start = (req, res) => {
  if (!configured()) return fail(res, "google_not_configured");
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, state, STATE_COOKIE_OPTS);
  const qs = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${qs}`);
};

// GET /auth/google/callback
exports.callback = async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) return fail(res, "google_denied");
    if (!code || !state || state !== req.cookies?.[STATE_COOKIE]) return fail(res, "invalid_state");
    res.clearCookie(STATE_COOKIE, STATE_COOKIE_OPTS);

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) {
      console.error("Google token error:", tokens);
      return fail(res, "google_token_failed");
    }
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const info = await infoRes.json();
    if (!infoRes.ok || !info.sub || !info.email || info.email_verified === false) return fail(res, "google_profile_failed");

    const email = String(info.email).toLowerCase();
    let user = await User.findOne({ $or: [{ google_id: info.sub }, { email }] });
    if (user) {
      if (user.status === "BLOCKED") return fail(res, "blocked");
      const patch = {};
      if (!user.google_id) patch.google_id = info.sub;
      if (user.status === "PENDING") patch.status = "ACTIVE"; // Google đã xác thực email
      if (!user.avatar_url && info.picture) patch.avatar_url = info.picture;
      if (Object.keys(patch).length) user = await User.findByIdAndUpdate(user._id, patch, { new: true });
    } else {
      user = await User.create({
        email,
        google_id: info.sub,
        password_hash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
        full_name: info.name || email.split("@")[0],
        first_name: info.given_name,
        last_name: info.family_name,
        avatar_url: info.picture,
        role: "CUSTOMER",
        status: "ACTIVE",
      });
    }

    const token = signToken({ id: user._id.toString(), username: user.username || user.email, role: user.role });
    res.cookie("token", token, COOKIE_OPTS);
    res.redirect(`${CLIENT_URL()}/auth/google/success?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error("Google callback error:", err);
    fail(res, "server_error");
  }
};
