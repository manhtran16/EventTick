const router = require("express").Router();
const ctrl = require("../controllers/bookingController");
const { requireAuth } = require("../middleware/auth");

router.get("/user/tickets", requireAuth, ctrl.myTickets);
router.post("/", requireAuth, ctrl.createBooking);
router.post("/carts/:eventId", requireAuth, ctrl.createBooking);
router.post("/create-payment-intent", ctrl.createPaymentIntent);
router.get("/orders/auth/:orderId", ctrl.getOrder);
router.post("/check-in", requireAuth, ctrl.checkInTicket);

module.exports = router;
