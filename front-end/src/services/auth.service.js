import apiClient from "./apiClient";

export const authService = {
  // Check current session & return user if logged in
  async getAuthStatus() {
    const res = await apiClient.get("/auth");
    return res.data;
  },

  // Log in
  async login(credentials) {
    const res = await apiClient.post("/auth/login", credentials);
    return res.data;
  },

  // Register
  async register(userData) {
    const res = await apiClient.post("/auth/register", userData);
    return res.data;
  },

  // Verify email by token
  async verifyEmail(token) {
    const res = await apiClient.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
    return res.data;
  },

  // Resend verification email
  async resendVerification(email) {
    const res = await apiClient.post("/auth/resend-verification", { email });
    return res.data;
  },

  // Request password reset email
  async forgotPassword(email) {
    const res = await apiClient.post("/auth/forgot-password", { email });
    return res.data;
  },

  // Reset password with token
  async resetPassword({ token, newPassword }) {
    const res = await apiClient.post("/auth/reset-password", { token, newPassword });
    return res.data;
  },

  // Change password for authenticated user
  async changePassword({ currentPassword, newPassword }) {
    const res = await apiClient.post("/auth/change-password", { currentPassword, newPassword });
    return res.data;
  },

  // Log out
  async logout() {
    const res = await apiClient.get("/auth/logout");
    return res.data;
  },

  // Fetch full user profile
  async getUserProfile() {
    const res = await apiClient.get("/auth/user");
    return res.data;
  },

  // Update user profile info
  async updateUserProfile(profileData) {
    const res = await apiClient.post("/auth/user/my-account", profileData);
    return res.data;
  },
};

export default authService;
