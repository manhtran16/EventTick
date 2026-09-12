import apiClient from "./apiClient";

export const eventService = {
  // Banner events
  async getBannerEvents() {
    const res = await apiClient.get("/events/in-banner");
    return res.data;
  },

  // Trending events
  async getTrendingEvents() {
    const res = await apiClient.get("/events/trending");
    return res.data;
  },

  // Special events
  async getSpecialEvents() {
    const res = await apiClient.get("/events/in-special");
    return res.data;
  },

  // Recommended events for user
  async getRecommendedEvents() {
    const res = await apiClient.get("/events/recommend");
    return res.data;
  },

  // Latest events this week
  async getLatestEventsWeek() {
    const res = await apiClient.get("/events/latest/week");
    return res.data;
  },

  // Latest events this month
  async getLatestEventsMonth() {
    const res = await apiClient.get("/events/latest/month");
    return res.data;
  },

  // Search events by query name or category
  async searchEvents({ name, category }) {
    const params = {};
    if (name) params.name = name;
    if (category) params.category = category;
    const res = await apiClient.get("/events/search", { params });
    return res.data;
  },

  // Get event details by ID
  async getEventById(eventId) {
    const res = await apiClient.get(`/events/${eventId}`);
    return res.data;
  },

  // Organizer's created events
  async getMyEvents() {
    const res = await apiClient.get("/events/my-event");
    return res.data;
  },

  // Create new event (multipart/form-data)
  async createEvent(formData) {
    const res = await apiClient.post("/events", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  // Check event creation authorization
  async checkEventAuth() {
    const res = await apiClient.get("/events/auth");
    return res;
  },
};

export default eventService;
