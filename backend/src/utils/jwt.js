const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET_KEY || "dev_secret_change_me";

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signToken, verifyToken };
