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
