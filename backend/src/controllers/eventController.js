const { Event, EventSession, TicketTier, Category, Ticket, User } = require('../models');
const { saveUploadedFile } = require('../utils/upload');
const { eventToClient } = require('../utils/serializers');
const { redis } = require('../config/redis');

const PUBLIC_STATUS = 'PUBLISHED'; // chỉ mở bán sau khi Organizer đã ký hợp đồng

/** Gắn event_sessions + ticket_tiers vào danh sách event (2 query cho cả danh sách). */
async function withTiers(events) {
  const ids = events.map((e) => e._id);
  const [sessions, tiers] = await Promise.all([
    EventSession.find({ event_id: { $in: ids } }),
    TicketTier.find({ event_id: { $in: ids } }).sort({ price: 1 }),
  ]);
  const sessByEvent = {};
  const tierByEvent = {};
  for (const s of sessions) (sessByEvent[s.event_id.toString()] ||= []).push(s);
  for (const t of tiers) (tierByEvent[t.event_id.toString()] ||= []).push(t);
  return events.map((e) => eventToClient(e, sessByEvent[e._id.toString()] || [], tierByEvent[e._id.toString()] || []));
}

// GET /events/:id
exports.getById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
    }
    // Sự kiện chưa mở bán chỉ chủ sự kiện và Admin xem được (dùng cho nút "Xem trước")
    if (!['PUBLISHED', 'ENDED'].includes(event.status)) {
      const viewer = req.user ? await User.findById(req.user.id).select('role status') : null;
      const allowed = viewer && viewer.status !== 'BLOCKED' && (viewer.role === 'ADMIN' || String(event.organizer_id) === String(viewer._id));
      if (!allowed) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });
    }
    const [populated] = await withTiers([event]);
    res.json({ success: true, event: populated });
  } catch (err) {
    res.status(400).json({ success: false, message: 'ID sự kiện không hợp lệ' });
  }
};

// GET /events/in-banner
exports.inBanner = async (req, res) => {
  const notEnded = { status: PUBLIC_STATUS, end_time: { $gt: new Date() } };
  let events = await Event.find({ ...notEnded, is_featured_banner: true }).sort({ start_time: 1 }).limit(5);
  if (events.length === 0) {
    events = await Event.find(notEnded).sort({ created_at: -1 }).limit(5);
  }
  res.json({ events: await withTiers(events) });
};

// GET /events/trending — top 10 sự kiện chưa kết thúc có nhiều vé bán ra nhất (không tính vé đã hoàn / vô hiệu do bán lại)
exports.trending = async (req, res) => {
  const top = await Ticket.aggregate([
    { $match: { status: { $in: ['VALID', 'USED', 'LISTED_RESALE'] } } },
    { $group: { _id: '$event_id', sold: { $sum: 1 } } },
    { $lookup: { from: 'events', localField: '_id', foreignField: '_id', as: 'event' } },
    { $unwind: '$event' },
    { $match: { 'event.status': PUBLIC_STATUS, 'event.end_time': { $gt: new Date() } } },
    { $sort: { sold: -1 } },
    { $limit: 10 },
  ]);
  const ids = top.map((t) => t._id);
  const docs = await Event.find({ _id: { $in: ids } });
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  const events = ids.map((i) => byId.get(String(i))).filter(Boolean); // giữ thứ tự xếp hạng
  res.json({ success: true, events: await withTiers(events) });
};

// GET /events/recommend
exports.recommend = async (req, res) => {
  const events = await Event.find({ status: PUBLIC_STATUS }).sort({ created_at: -1 }).limit(10);
  res.json({ events: await withTiers(events) });
};

// GET /events/latest/week & /latest/month
exports.latest = async (req, res) => {
  const { from, to } = req.query;
  const filter = { status: PUBLIC_STATUS };
  if (from || to) {
    filter.start_time = {};
    if (from) filter.start_time.$gte = new Date(from);
    if (to) filter.start_time.$lte = new Date(to);
  }
  const events = await Event.find(filter).sort({ start_time: 1 }).limit(20);
  res.json({ success: true, events: await withTiers(events) });
};

// GET /events/search?name=&category=&city=&from=&to=&minPrice=&maxPrice=&sort=&page=&limit=
exports.search = async (req, res) => {
  try {
    const {
      name,
      keyword,
      q,
      category,
      categoryId,
      city,
      from,
      to,
      startDate,
      endDate,
      minPrice,
      maxPrice,
      hasSeatMap,
      sort,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = { status: PUBLIC_STATUS };

    const textQuery = name || keyword || q;
    if (textQuery) {
      const rx = { $regex: String(textQuery).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      filter.$or = [{ title: rx }, { slug: rx }, { city: rx }, { venue_name: rx }, { description: rx }];
    }

    if (city) {
      filter.city = { $regex: String(city).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const catTarget = categoryId || category;
    if (catTarget) {
      const isObjId = catTarget.length === 24 && /^[0-9a-fA-F]{24}$/.test(catTarget);
      let cat = null;
      if (isObjId) {
        cat = await Category.findById(catTarget);
      }
      if (!cat) {
        cat = await Category.findOne({ $or: [{ name: catTarget }, { slug: catTarget }] });
      }
      if (!cat) {
        return res.json({ success: true, events: [], total: 0, page: 1, totalPages: 0, limit: Number(limit) });
      }
      filter.category_id = cat._id;
    }

    const fromDate = from || startDate;
    const toDate = to || endDate;
    if (fromDate || toDate) {
      filter.start_time = {};
      if (fromDate) filter.start_time.$gte = new Date(fromDate);
      if (toDate) filter.start_time.$lte = new Date(toDate);
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.lowest_price = {};
      if (minPrice !== undefined && minPrice !== '') filter.lowest_price.$gte = Number(minPrice);
      if (maxPrice !== undefined && maxPrice !== '') filter.lowest_price.$lte = Number(maxPrice);
      if (Object.keys(filter.lowest_price).length === 0) delete filter.lowest_price;
    }

    if (hasSeatMap !== undefined && hasSeatMap !== '') {
      filter.has_seat_map = hasSeatMap === 'true' || hasSeatMap === true;
    }

    let sortOption = { created_at: -1 };
    if (sort === 'price_asc') sortOption = { lowest_price: 1 };
    else if (sort === 'price_desc') sortOption = { lowest_price: -1 };
    else if (sort === 'date_asc') sortOption = { start_time: 1 };
    else if (sort === 'date_desc') sortOption = { start_time: -1 };
    else if (sort === 'newest') sortOption = { created_at: -1 };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [total, events] = await Promise.all([
      Event.countDocuments(filter),
      Event.find(filter).sort(sortOption).skip(skip).limit(limitNum),
    ]);

    const populated = await withTiers(events);
    res.json({
      success: true,
      events: populated,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      limit: limitNum,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /events/my-event
exports.myEvents = async (req, res) => {
  const events = await Event.find({ organizer_id: req.user.id }).sort({ created_at: -1 });
  res.json({
    success: true,
    events: events.map((e) => ({
      _id: e._id,
      title: e.title,
      eventName: e.title,
      bannerUrl: e.banner_url,
      backgroundImage: e.banner_url,
      thumbnailUrl: e.thumbnail_url || e.banner_url,
      eventImage: e.thumbnail_url || e.banner_url,
      location: e.venue_name,
      eventAddress: e.venue_name,
      venueName: e.venue_name,
      status: e.status,
      rejectionReason: e.rejection_reason,
      createdAt: e.created_at,
    })),
  });
};

// GET /events/sessions/:sessionId/seats — sơ đồ ghế của 1 suất (UC11)
// Trạng thái hiển thị = trạng thái Mongo, ghế đang bị khóa trong Redis cũng hiện LOCKED.
exports.getSessionSeats = async (req, res) => {
  try {
    const { Seat } = require('../models');
    const { getLockedSeatIds } = require('../services/seatLockService');
    const session = await EventSession.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Không tìm thấy suất diễn' });

    const [seats, tiers] = await Promise.all([
      Seat.find({ session_id: session._id }).sort({ section_name: 1, row_label: 1, seat_number: 1 }),
      TicketTier.find({ session_id: session._id }),
    ]);
    const redisLocked = await getLockedSeatIds(
      session._id,
      seats.map((s) => s._id),
    );
    const now = new Date();
    const status = (s) => {
      if (s.status === 'SOLD') return 'SOLD';
      if (s.status === 'LOCKED' && s.lock_expires_at > now) return 'LOCKED';
      return redisLocked.has(s.id) ? 'LOCKED' : 'AVAILABLE';
    };

    res.json({
      success: true,
      session: {
        _id: session._id,
        name: session.name,
        startTime: session.start_time,
        endTime: session.end_time,
        seatMap: session.seat_map,
      },
      tiers: tiers.map((t) => ({
        _id: t._id,
        name: t.name,
        price: t.price,
        desc: t.description,
        zoneColor: t.zone_color,
        zoneType: t.zone_type || 'GA',
        minPerOrder: t.min_per_order,
        maxPerOrder: t.max_per_order,
        numberOfTicketLeft: t.available_quantity,
      })),
      seats: seats.map((s) => ({
        _id: s._id,
        tierId: s.tier_id,
        section: s.section_name,
        row: s.row_label,
        number: s.seat_number,
        x: s.coord_x,
        y: s.coord_y,
        status: status(s),
      })),
    });
  } catch (err) {
    res.status(400).json({ success: false, message: 'ID suất diễn không hợp lệ' });
  }
};

const memWaitingRooms = new Map();

// POST /events/:id/waiting-room/join (UC09)
exports.joinWaitingRoom = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });

    const identifier = req.user?.id || req.body?.identifier || req.ip;
    const qKey = `waiting_room:${event._id}`;
    const now = Date.now();

    if (redis && redis.status === 'ready') {
      await redis.zadd(qKey, 'NX', now, String(identifier));
      const rank = await redis.zrank(qKey, String(identifier));
      const position = rank !== null ? rank + 1 : 1;
      const passGranted = position <= 10;
      let passToken = null;
      if (passGranted) {
        passToken = `PASS-${event._id}-${identifier}-${now}`;
        await redis.setex(`waiting_pass:${event._id}:${identifier}`, 300, passToken);
      }
      return res.json({
        success: true,
        position,
        passGranted,
        passToken,
        estimatedWaitTimeSeconds: Math.max(0, (position - 10) * 10),
      });
    }

    if (!memWaitingRooms.has(String(event._id))) {
      memWaitingRooms.set(String(event._id), new Set());
    }
    memWaitingRooms.get(String(event._id)).add(String(identifier));

    res.json({
      success: true,
      position: 1,
      passGranted: true,
      passToken: `PASS-${event._id}-${identifier}-${now}`,
      estimatedWaitTimeSeconds: 0,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /events/:id/waiting-room/status (UC09)
exports.waitingRoomStatus = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Không tìm thấy sự kiện' });

    const identifier = req.user?.id || req.query.identifier || req.ip;
    const qKey = `waiting_room:${event._id}`;

    if (redis && redis.status === 'ready') {
      const rank = await redis.zrank(qKey, String(identifier));
      if (rank === null) {
        return res.json({ success: true, inQueue: false, passGranted: true });
      }
      const position = rank + 1;
      const passGranted = position <= 10;
      let passToken = null;
      if (passGranted) {
        passToken = await redis.get(`waiting_pass:${event._id}:${identifier}`);
        if (!passToken) {
          passToken = `PASS-${event._id}-${identifier}-${Date.now()}`;
          await redis.setex(`waiting_pass:${event._id}:${identifier}`, 300, passToken);
        }
      }
      return res.json({
        success: true,
        inQueue: true,
        position,
        passGranted,
        passToken,
        estimatedWaitTimeSeconds: Math.max(0, (position - 10) * 10),
      });
    }

    const inMemSet = memWaitingRooms.get(String(event._id));
    const inQueue = inMemSet ? inMemSet.has(String(identifier)) : true;

    res.json({
      success: true,
      inQueue,
      position: 1,
      passGranted: true,
      passToken: `PASS-${event._id}-${identifier}-${Date.now()}`,
      estimatedWaitTimeSeconds: 0,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
