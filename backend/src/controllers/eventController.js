const Event = require("../models/Event");
const { saveUploadedFile } = require("../utils/upload");

/**
 * Chuyển 1 Event document thành JSON gửi cho front-end.
 * Quan trọng: front-end (EventDetails.jsx) đọc ticket.soldOut dưới dạng STRING
 * "true"/"false" (không phải boolean) — giữ đúng để không phải sửa front-end.
 */
function toClientEvent(eventDoc) {
  const e = eventDoc.toObject();
  e.sessions = e.sessions.map((s) => ({
    ...s,
    tickets: s.tickets.map((t) => ({
      ...t,
      soldOut: t.sold >= t.stock ? "true" : "false",
    })),
  }));
  return e;
}

// GET /events/:id
exports.getById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: "Không tìm thấy sự kiện" });
    res.json({ success: true, event: toClientEvent(event) });
  } catch (err) {
    res.status(400).json({ success: false, message: "ID sự kiện không hợp lệ" });
  }
};

// GET /events/in-banner?from&to  (BannerSection.jsx)
exports.inBanner = async (req, res) => {
  const events = await Event.find({}).sort({ createdAt: -1 }).limit(5);
  res.json({ events: events.map(toClientEvent) });
};

// GET /events/trending?from&to  (TrendingEvent.jsx)
exports.trending = async (req, res) => {
  const events = await Event.find({ isTrending: true }).limit(10);
  res.json({ success: true, events: events.map(toClientEvent) });
};

// GET /events/in-special?from&to  (SpecialEvent.jsx)
exports.special = async (req, res) => {
  const events = await Event.find({ isSpecial: true }).limit(10);
  res.json({ success: true, events: events.map(toClientEvent) });
};

// GET /events/recommend  (ForYou.jsx)
exports.recommend = async (req, res) => {
  const events = await Event.find({}).sort({ createdAt: -1 }).limit(10);
  res.json({ events: events.map(toClientEvent) });
};

// GET /events/latest/week & /events/latest/month  (LatestEvent.jsx — dùng chung 1 handler)
exports.latest = async (req, res) => {
  const { from, to } = req.query;
  const filter = {};
  if (from || to) {
    filter.earliestDate = {};
    if (from) filter.earliestDate.$gte = new Date(from);
    if (to) filter.earliestDate.$lte = new Date(to);
  }
  const events = await Event.find(filter).sort({ earliestDate: 1 }).limit(20);
  res.json({ success: true, events: events.map(toClientEvent) });
};

// GET /events/search?name=&category=  (SearchResultsPage.jsx)
exports.search = async (req, res) => {
  const { name, category } = req.query;
  const filter = {};
  if (name) filter.eventName = { $regex: name, $options: "i" };
  else if (category) filter.category = category;

  const events = await Event.find(filter).limit(50);
  res.json({ events: events.map(toClientEvent) });
};

// GET /events/my-event  (MyEventPage.jsx — yêu cầu đăng nhập)
exports.myEvents = async (req, res) => {
  const events = await Event.find({ ownerId: req.user.id });
  res.json({
    success: true,
    events: events.map((e) => ({
      _id: e._id,
      eventName: e.eventName,
      eventImage: e.eventImage || e.backgroundImage,
      eventAddress: e.venueName,
    })),
  });
};

// POST /events  (CreateEventPage.jsx — multipart/form-data, yêu cầu đăng nhập)
// Body: field "data" là JSON string { eventName, venueName, category, eventDesc,
//   organizerInfo, sessions: [{eventDate, startTime, tickets:[{name,price,quantity,minOrder,desc}]}], ... }
// Files: "backgroundImage", "eventImage" (đã cấu hình multer ở routes/eventRoutes.js)
exports.create = async (req, res) => {
  try {
    const payload = JSON.parse(req.body.data || "{}");
    const backgroundFile = req.files?.backgroundImage?.[0];
    const eventFile = req.files?.eventImage?.[0];

    if (!payload.eventName) {
      return res.status(400).json({ success: false, message: "Thiếu tên sự kiện" });
    }

    const backgroundUrl = backgroundFile ? await saveUploadedFile(req, backgroundFile) : payload.backgroundImage;
    const eventImageUrl = eventFile ? await saveUploadedFile(req, eventFile) : payload.eventImage;

    const event = await Event.create({
      eventName: payload.eventName,
      eventDesc: payload.eventDesc,
      organizerInfo: payload.organizerInfo,
      organizerName: payload.organizerName,
      venueName: payload.venueName,
      eventAddress: payload.eventAddress,
      eventType: payload.eventType,
      category: payload.category,
      backgroundImage: backgroundUrl,
      eventImage: eventImageUrl,
      ownerId: req.user.id,
      sessions: (payload.sessions || []).map((s) => ({
        eventDate: s.eventDate,
        startTime: s.startTime,
        tickets: (s.tickets || []).map((t) => ({
          name: t.name,
          price: Number(t.price) || 0,
          stock: Number(t.quantity) || 0,
          minOrder: Number(t.minOrder) || 1,
          desc: t.desc,
        })),
      })),
    });

    res.json({ success: true, eventId: event._id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
