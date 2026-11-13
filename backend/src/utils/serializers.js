/**
 * Chuyển document theo schema mới (snake_case) sang định dạng front-end đang đọc
 * (eventName, sessions[].tickets[], ...).
 * Cấu trúc: events (1) -> (N) event_sessions (1) -> (N) ticket_tiers.
 */

function tierToClient(t) {
  const left = t.available_quantity;
  return {
    _id: t._id,
    id: t._id,
    name: t.name,
    price: t.price,
    desc: t.description,
    description: t.description,
    zoneColor: t.zone_color,
    zoneType: t.zone_type || 'GA',
    zone_type: t.zone_type || 'GA',
    stock: t.total_quantity,
    totalCapacity: t.total_quantity,
    remaining: left,
    availableCapacity: left,
    numberOfTicketLeft: left,
    soldOut: left <= 0 ? 'true' : 'false',
    minPerOrder: t.min_per_order,
    maxPerOrder: t.max_per_order,
    saleStartTime: t.sale_start_time,
    saleEndTime: t.sale_end_time,
  };
}

function sessionToClient(sessionDoc, tiers = []) {
  const s = sessionDoc.toObject ? sessionDoc.toObject({ virtuals: false }) : { ...sessionDoc };
  const tickets = tiers.map(tierToClient);
  return {
    _id: s._id,
    id: s._id,
    name: s.name,
    eventDate: s.start_time,
    startTime: s.start_time,
    endTime: s.end_time,
    status: s.status,
    seatMap: s.seat_map,
    zones: tickets,
    tickets,
  };
}

function eventToClient(eventDoc, sessions = [], tiers = []) {
  const e = eventDoc.toObject ? eventDoc.toObject({ virtuals: false }) : { ...eventDoc };
  const tiersBySession = {};
  for (const t of tiers) (tiersBySession[t.session_id.toString()] ||= []).push(t);
  const sessionList = [...sessions]
    .sort((a, b) => a.start_time - b.start_time)
    .map((s) => sessionToClient(s, tiersBySession[s._id.toString()] || []));
  return {
    ...e,
    id: e._id,
    // alias cho front-end
    eventName: e.title,
    eventDesc: e.description,
    venueName: e.venue_name,
    eventAddress: [e.venue_name, e.city].filter(Boolean).join(', '),
    backgroundImage: e.banner_url,
    eventImage: e.thumbnail_url || e.banner_url,
    bannerUrl: e.banner_url,
    thumbnailUrl: e.thumbnail_url || e.banner_url,
    location: e.venue_name,
    organizerId: e.organizer_id,
    lowestPrice: e.lowest_price ?? 0,
    earliestDate: e.start_time,
    lastDate: e.end_time,
    isTrending: e.is_trending,
    isSpecial: e.is_special,
    rejectionReason: e.rejection_reason,
    createdAt: e.created_at,
    sessions: sessionList,
  };
}

function userToClient(u) {
  return {
    id: u._id,
    username: u.username || u.email,
    email: u.email,
    avatar: u.avatar_url,
    name: u.full_name,
    role: u.role,
  };
}

module.exports = { tierToClient, sessionToClient, eventToClient, userToClient };
