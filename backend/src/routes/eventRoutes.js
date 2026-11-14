const router = require('express').Router();
const ctrl = require('../controllers/eventController');
const { requireAuth } = require('../middleware/auth');
const seatMap = require('../controllers/seatMapController');

// LƯU Ý: Các route cố định phải đặt TRƯỚC route động "/:id"
router.get('/in-banner', ctrl.inBanner);
router.get('/trending', ctrl.trending);
router.get('/recommend', ctrl.recommend);
router.get('/latest/week', ctrl.latest);
router.get('/latest/month', ctrl.latest);
router.get('/search', ctrl.search);
router.get('/my-event', requireAuth, ctrl.myEvents);
router.get('/sessions/:sessionId/seats', ctrl.getSessionSeats);
router.get('/sessions/:sessionId/seat-map', seatMap.publicMap);

// Tạo / sửa / huỷ sự kiện của Nhà tổ chức nằm ở /v1/organizer/events (POST /v1/events vẫn dùng được, gọi cùng một xử lý)
const { requireVerifiedOrganizer } = require('../middleware/auth');
const upload = require('../utils/upload');
router.post('/', requireVerifiedOrganizer, upload.any(), require('../controllers/organizerEventController').create);

// Phòng chờ ảo (UC09)
router.post('/:id/waiting-room/join', ctrl.joinWaitingRoom);
router.get('/:id/waiting-room/status', ctrl.waitingRoomStatus);

// Chi tiết sự kiện theo ID
router.get('/:id', ctrl.getById);

module.exports = router;
