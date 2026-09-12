import apiClient from "./apiClient";

export const bookingService = {
  // Get realtime seats for an event
  async getSeats(eventId) {
    const res = await apiClient.get(`/seats/${eventId}`);
    return res.data;
  },

  // Create payment intent
  async createPaymentIntent(orderId) {
    const res = await apiClient.post("/booking/create-payment-intent", {
      orderId,
    });
    return res.data;
  },

  // Get order status
  async getOrder(orderId) {
    const res = await apiClient.get(`/booking/orders/auth/${orderId}`);
    return res.data;
  },

  // Check user booking ticket authorization
  async checkTicketAuth() {
    const res = await apiClient.get("/booking/user/tickets");
    return res;
  },

  // Get user's purchased tickets
  async getUserTickets() {
    const res = await apiClient.get("/booking/user/tickets");
    return res.data;
  },
};

export default bookingService;
