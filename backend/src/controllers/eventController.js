const { Event, Zone, Category } = require("../models");
const { saveUploadedFile } = require("../utils/upload");

/**
 * Format 1 Event document và gắn kèm các Zone (hạng vé) vào từng Session.
 * Đảm bảo tương thích 100% với cả format mới (Zone) và format cũ của frontend (tickets[]).
 */
async function populateEventWithZones(eventDoc) {
  if (!eventDoc) return null;
  const eventObj = eventDoc.toObject ? eventDoc.toObject() : { ...eventDoc };

  const zones = await Zone.find({ eventId: eventObj._id });
  const zonesBySession = {};
  for (const z of zones) {
    const sId = z.sessionId.toString();
    if (!zonesBySession[sId]) zonesBySession[sId] = [];
    zonesBySession[sId].push({
      _id: z._id,
      id: z._id,
      name: z.name,
      price: z.price,
      totalCapacity: z.totalCapacity,
      availableCapacity: z.availableCapacity,
      stock: z.totalCapacity,
      remaining: z.availableCapacity,
      numberOfTicketLeft: z.availableCapacity,
      soldOut: z.availableCapacity <= 0 ? "true" : "false",
      desc: z.description,
      description: z.description,
      maxPerOrder: z.maxPerOrder,
    });
  }

  eventObj.sessions = (eventObj.sessions || []).map((s) => {
    const sId = s._id.toString();
    const sessionZones = zonesBySession[sId] || [];
    return {
      ...s,
      zones: sessionZones,
      tickets: sessionZones, // Tương thích với frontend cũ đọc session.tickets
    };
  });

  // Tương thích các trường cũ/mới
  eventObj.eventName = eventObj.title;
  eventObj.eventDesc = eventObj.description;
  eventObj.venueName = eventObj.location;
  eventObj.eventAddress = eventObj.location;
  eventObj.backgroundImage = eventObj.bannerUrl;
  eventObj.eventImage = eventObj.thumbnailUrl || eventObj.bannerUrl;

  return eventObj;
}

function toClientEventSimple(e) {
  const obj = e.toObject ? e.toObject() : { ...e };
  return {
    ...obj,
    eventName: obj.title || obj.eventName,
    eventDesc: obj.description || obj.eventDesc,
    venueName: obj.location || obj.venueName,
    eventAddress: obj.location || obj.eventAddress,
    backgroundImage: obj.bannerUrl || obj.backgroundImage,
    eventImage: obj.thumbnailUrl || obj.bannerUrl || obj.eventImage,
  };
}

// GET /events/:id
exports.getById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sự kiện" });
    }
    const populated = await populateEventWithZones(event);
    res.json({ success: true, event: populated });
  } catch (err) {
    res.status(400).json({ success: false, message: "ID sự kiện không hợp lệ" });
  }
};

// GET /events/in-banner (BannerSection.jsx)
exports.inBanner = async (req, res) => {
  const events = await Event.find({ status: { $in: ["APPROVED", "approved"] } })
    .sort({ createdAt: -1 })
    .limit(5);
  res.json({ events: events.map(toClientEventSimple) });
};

// GET /events/trending (TrendingEvent.jsx)
exports.trending = async (req, res) => {
  const events = await Event.find({
    isTrending: true,
    status: { $in: ["APPROVED", "approved"] },
  }).limit(10);
  res.json({ success: true, events: events.map(toClientEventSimple) });
};

// GET /events/in-special (SpecialEvent.jsx)
exports.special = async (req, res) => {
  const events = await Event.find({
    isSpecial: true,
    status: { $in: ["APPROVED", "approved"] },
  }).limit(10);
  res.json({ success: true, events: events.map(toClientEventSimple) });
};

// GET /events/recommend (ForYou.jsx)
exports.recommend = async (req, res) => {
  const events = await Event.find({ status: { $in: ["APPROVED", "approved"] } })
    .sort({ createdAt: -1 })
    .limit(10);
  res.json({ events: events.map(toClientEventSimple) });
};

// GET /events/latest/week & /events/latest/month (LatestEvent.jsx)
exports.latest = async (req, res) => {
  const { from, to } = req.query;
  const filter = { status: { $in: ["APPROVED", "approved"] } };
  if (from || to) {
    filter.earliestDate = {};
    if (from) filter.earliestDate.$gte = new Date(from);
    if (to) filter.earliestDate.$lte = new Date(to);
  }
  const events = await Event.find(filter).sort({ earliestDate: 1 }).limit(20);
  res.json({ success: true, events: events.map(toClientEventSimple) });
};

// GET /events/search?name=&category=&eventType=&priceMin=&priceMax=&sort=&page=&limit= (SearchResultsPage.jsx)
exports.search = async (req, res) => {
  try {
    const {
      name,
      category,
      eventType,
      priceMin,
      priceMax,
      sort,
      page = 1,
      limit = 12,
    } = req.query;

    const filter = { status: { $in: ["APPROVED", "approved"] } };

    // 1. Keyword search (Name, Slug, Location)
    if (name) {
      filter.$or = [
        { title: { $regex: name, $options: "i" } },
        { slug: { $regex: name, $options: "i" } },
        { location: { $regex: name, $options: "i" } },
      ];
    }

    // 2. Exact match filters
    if (category) filter.category = category;
    if (eventType) filter.eventType = eventType;

    // 3. Price range filter
    if (priceMin || priceMax) {
      filter.lowestPrice = {};
      if (priceMin) filter.lowestPrice.$gte = Number(priceMin);
      if (priceMax) filter.lowestPrice.$lte = Number(priceMax);
    }

    // 4. Pagination
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 12;
    const skip = (pageNumber - 1) * pageSize;

    // 5. Sorting
    let sortObj = { createdAt: -1 }; // Mặc định mới nhất
    if (sort === "price_asc") sortObj = { lowestPrice: 1 };
    else if (sort === "price_desc") sortObj = { lowestPrice: -1 };
    else if (sort === "date_asc") sortObj = { earliestDate: 1 };
    else if (sort === "date_desc") sortObj = { earliestDate: -1 };

    const totalEvents = await Event.countDocuments(filter);
    const events = await Event.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(pageSize);

    res.json({
      success: true,
      events: events.map(toClientEventSimple),
      pagination: {
        total: totalEvents,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(totalEvents / pageSize),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /events/my-event (MyEventPage.jsx — bất kỳ user nào đăng nhập đều xem được sự kiện mình tạo)
exports.myEvents = async (req, res) => {
  const events = await Event.find({ organizerId: req.user.id }).sort({ createdAt: -1 });
  res.json({
    success: true,
    events: events.map((e) => ({
      _id: e._id,
      title: e.title,
      eventName: e.title,
      bannerUrl: e.bannerUrl,
      backgroundImage: e.bannerUrl,
      thumbnailUrl: e.thumbnailUrl || e.bannerUrl,
      eventImage: e.thumbnailUrl || e.bannerUrl,
      location: e.location,
      eventAddress: e.location,
      venueName: e.location,
      status: e.status,
      rejectionReason: e.rejectionReason,
      createdAt: e.createdAt,
    })),
  });
};

// POST /events (CreateEventPage.jsx — MỌI user đăng ký đều có quyền tạo sự kiện, mặc định PENDING)
exports.create = async (req, res) => {
  try {
    const payload = JSON.parse(req.body.data || "{}");
    const files = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files || {}).flat();
    const backgroundFile = files.find((f) => f.fieldname === "backgroundImage");
    const eventFile = files.find((f) => f.fieldname === "eventImage");

    const eventTitle = payload.title || payload.eventName;
    if (!eventTitle) {
      return res.status(400).json({ success: false, message: "Thiếu tên sự kiện" });
    }

    const backgroundUrl = backgroundFile
      ? await saveUploadedFile(req, backgroundFile)
      : payload.backgroundImage || payload.bannerUrl || "https://picsum.photos/seed/default/800/450";

    const eventImageUrl = eventFile
      ? await saveUploadedFile(req, eventFile)
      : payload.eventImage || payload.thumbnailUrl || backgroundUrl;

    // 1. Tạo các session subdocument
    const rawSessions = payload.sessions || [];
    const sessionsToInsert = rawSessions.length > 0
      ? rawSessions.map((s, idx) => ({
          name: s.name || `Suất diễn ${idx + 1}`,
          eventDate: new Date(s.eventDate || Date.now()),
          startTime: new Date(s.startTime || Date.now()),
          endTime: s.endTime ? new Date(s.endTime) : undefined,
        }))
      : [
          {
            name: "Suất diễn chính",
            eventDate: new Date(),
            startTime: new Date(),
          },
        ];

    // 2. Tạo Event với trạng thái PENDING chờ Admin duyệt
    const event = new Event({
      organizerId: req.user.id,
      title: eventTitle,
      category: payload.category || "Hội thảo & Workshop",
      description: payload.description || payload.eventDesc || "",
      location: payload.location || payload.venueName || payload.eventAddress || "Địa điểm chưa xác định",
      bannerUrl: backgroundUrl,
      thumbnailUrl: eventImageUrl,
      organizerName: payload.organizerName || req.user.username,
      organizerInfo: payload.organizerInfo || "",
      eventType: payload.eventType || "offline",
      sessions: sessionsToInsert,
      status: "PENDING",
      allowResale: payload.allowResale || false,
      allowGift: payload.allowGift || false,
    });

    await event.save();

    // 3. Tạo Zone cho từng Session
    const zonesToInsert = [];
    let lowestPrice = Infinity;

    rawSessions.forEach((s, sIdx) => {
      const createdSession = event.sessions[sIdx];
      const sessionTickets = s.tickets || s.zones || [];

      if (sessionTickets.length > 0) {
        sessionTickets.forEach((t) => {
          const price = Number(t.price) || 0;
          const capacity = Number(t.quantity || t.stock || t.totalCapacity) || 50;
          if (price < lowestPrice) lowestPrice = price;

          zonesToInsert.push({
            eventId: event._id,
            sessionId: createdSession._id,
            name: t.name || "Vé Thường",
            price,
            totalCapacity: capacity,
            availableCapacity: capacity,
            maxPerOrder: Number(t.maxPerOrder) || 10,
            description: t.desc || t.description || "",
          });
        });
      } else {
        // Mặc định 1 zone nếu người dùng không thêm
        zonesToInsert.push({
          eventId: event._id,
          sessionId: createdSession._id,
          name: "Vé Thường",
          price: 100000,
          totalCapacity: 100,
          availableCapacity: 100,
        });
        if (100000 < lowestPrice) lowestPrice = 100000;
      }
    });

    if (zonesToInsert.length > 0) {
      await Zone.insertMany(zonesToInsert);
    }

    event.lowestPrice = lowestPrice === Infinity ? 0 : lowestPrice;
    await event.save();

    res.json({
      success: true,
      message: "Tạo sự kiện thành công! Sự kiện đang chờ Admin phê duyệt.",
      eventId: event._id,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /events/admin/pending (Lấy danh sách sự kiện chờ duyệt - Chỉ Admin)
exports.getPendingEvents = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({ success: false, message: "Chỉ Admin mới có quyền xem" });
    const events = await Event.find({ status: "PENDING" }).populate("organizerId", "username email fullName").sort({ createdAt: -1 });
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /events/:id/approve (Admin duyệt sự kiện)
exports.approve = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({ success: false, message: "Chỉ Admin mới có quyền duyệt sự kiện" });
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { status: "APPROVED", rejectionReason: null },
      { new: true },
    );
    if (!event) return res.status(404).json({ success: false, message: "Không tìm thấy sự kiện" });
    res.json({ success: true, message: "Đã phê duyệt sự kiện", event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /events/:id/reject (Admin từ chối sự kiện)
exports.reject = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({ success: false, message: "Chỉ Admin mới có quyền từ chối sự kiện" });
    const { reason } = req.body;
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { status: "REJECTED", rejectionReason: reason || "Không đạt tiêu chuẩn kiểm duyệt" },
      { new: true },
    );
    if (!event) return res.status(404).json({ success: false, message: "Không tìm thấy sự kiện" });
    res.json({ success: true, message: "Đã từ chối sự kiện", event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /events/:id (Cập nhật sự kiện)
exports.update = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: "Không tìm thấy sự kiện" });
    
    if (event.organizerId.toString() !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Không có quyền cập nhật sự kiện này" });
    }

    const payload = JSON.parse(req.body.data || "{}");
    const files = Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat();
    const backgroundFile = files.find((f) => f.fieldname === "backgroundImage");
    const eventFile = files.find((f) => f.fieldname === "eventImage");

    if (payload.title || payload.eventName) event.title = payload.title || payload.eventName;
    if (payload.category) event.category = payload.category;
    if (payload.description || payload.eventDesc) event.description = payload.description || payload.eventDesc;
    if (payload.location || payload.venueName || payload.eventAddress) event.location = payload.location || payload.venueName || payload.eventAddress;
    if (payload.organizerName) event.organizerName = payload.organizerName;
    if (payload.organizerInfo) event.organizerInfo = payload.organizerInfo;
    if (payload.eventType) event.eventType = payload.eventType;
    if (payload.allowResale !== undefined) event.allowResale = payload.allowResale;
    if (payload.allowGift !== undefined) event.allowGift = payload.allowGift;
    
    if (backgroundFile) {
      event.bannerUrl = await saveUploadedFile(req, backgroundFile);
    }
    if (eventFile) {
      event.thumbnailUrl = await saveUploadedFile(req, eventFile);
    }

    await event.save();
    res.json({ success: true, message: "Cập nhật sự kiện thành công", event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /events/:id (Xóa sự kiện)
exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: "Không tìm thấy sự kiện" });
    
    if (event.organizerId.toString() !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Không có quyền xóa sự kiện này" });
    }

    await Event.findByIdAndDelete(req.params.id);
    await Zone.deleteMany({ eventId: req.params.id });

    res.json({ success: true, message: "Đã xóa sự kiện thành công" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
