export const PATHS = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  VERIFY_EMAIL: "/verify-email",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",

  // Events
  EVENT_DETAILS: "/event/:eventId",
  EVENT_SEATS: "/event/seats/:eventId",
  SEARCH: "/search",

  // User
  USER_TICKETS: "/user/tickets",
  USER_TICKETS_TEST: "/user/tickets/test",
  USER_ACCOUNT: "/user/my-account",

  // Admin / Organizer
  ADMIN_CREATE_EVENT: "/admin/events",
  ADMIN_CREATE_EVENT_TEST: "/admin/events/test",
  ADMIN_MY_EVENTS: "/admin/my-event",

  // Payment
  PAYMENT: "/payment/:orderId",
  PAYMENT_RESULT: "/payment-result/:orderId",
  PAYMENT_DONE: "/payment-done",
  PAYMENT_FAIL: "/payment-fail",
  PAYMENT_ERROR: "/payment-err",
};

export default PATHS;
