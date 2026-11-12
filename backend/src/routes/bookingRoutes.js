const router = require("express").Router();
const ctrl = require("../controllers/bookingController");
const { requireAuth } = require("../middleware/auth");

router.get("/user/tickets", requireAuth, ctrl.myTickets);
router.get("/tickets/:id/status", requireAuth, ctrl.getTicketStatus);
router.post("/", requireAuth, ctrl.createBooking);
router.post("/voucher-preview", requireAuth, ctrl.previewVoucher);
router.post("/carts/:eventId", requireAuth, ctrl.createBooking);
router.put("/orders/:orderId/checkout-info", requireAuth, ctrl.updateCheckoutInfo);
router.post("/create-payment-intent", ctrl.createPaymentIntent);
router.get("/orders/auth/:orderId", ctrl.getOrder);
router.post("/orders/:orderId/cancel", requireAuth, ctrl.cancelOrder);
router.get("/refund-requests", requireAuth, ctrl.getMyRefundRequests);
router.post("/check-in", requireAuth, ctrl.checkInTicket);
router.get("/staff/my-events", requireAuth, ctrl.myStaffEvents);
router.get("/staff/events/:eventId/check-in-stats", requireAuth, ctrl.getStaffCheckInStats);

module.exports = router;
