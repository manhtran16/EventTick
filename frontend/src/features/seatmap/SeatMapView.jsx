import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import usePanZoom from "./usePanZoom";
import { layoutAllSeats } from "./layoutSeats";
import "./SeatMap.css";

const SHAPES = "path, polygon, rect, circle, ellipse, polyline";
const money = (v) => `${Number(v || 0).toLocaleString("vi-VN")} đ`;

/**
 * Sơ đồ chỗ ngồi 1 tầng: mặt bằng SVG (tự vẽ từ hạng vé hoặc từ file) + ghế vẽ ngay trên mặt bằng, bấm chọn trực tiếp.
 *  - Khu "SEC_*" tô màu theo hạng vé; khu hết vé mờ đi. Ghế đặt đúng hình khu (hàng thẳng hoặc cong quanh sân khấu).
 *  - Ghế: trắng = trống, xanh = đang chọn, đỏ = không chọn được.
 *  - Khu đứng (GA): bấm vào khu để chọn số lượng (onSelectSection).
 * seats: [{ _id, section, row, number, x, y, status }]. selectedCount: { [sectionId]: số vé GA đang chọn }.
 */
export default function SeatMapView({
  svgContent,
  sections,
  seats = [],
  selectedSeatIds = new Set(),
  selectedCount = {},
  onToggleSeat = () => {},
  onSelectSection = () => {},
  highlightTierId = null,
}) {
  const svgRef = useRef(null);
  const [tip, setTip] = useState(null);
  const [layout, setLayout] = useState({ vb: null, bySection: {} });
  const { attach, handlers: panHandlers, dragging, wasDragged, style: panStyle, zoomIn, zoomOut, reset: resetView } = usePanZoom({ min: 0.6, max: 8 });

  const html = useMemo(
    () => DOMPurify.sanitize(svgContent || "", { USE_PROFILES: { svg: true, svgFilters: true } }),
    [svgContent],
  );
  const byId = useMemo(() => new Map(sections.map((s) => [s.sectionId, s])), [sections]);
  const seatsBySection = useMemo(() => {
    const m = new Map();
    seats.forEach((s) => {
      if (!m.has(s.section)) m.set(s.section, []);
      m.get(s.section).push(s);
    });
    return m;
  }, [seats]);

  // Chỉ tính lại vị trí ghế khi SVG / cấu trúc ghế đổi (không phải mỗi lần trạng thái ghế đổi)
  const structKey = useMemo(
    () => `${html.length}|${sections.map((s) => `${s.sectionId}:${s.layout}`).join(",")}|${seats.length}|${seats[0]?._id}|${seats[seats.length - 1]?._id}`,
    [html, sections, seats],
  );
  useLayoutEffect(() => {
    const root = svgRef.current;
    if (!root) return;
    setLayout(layoutAllSeats(root, sections, seats));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structKey]);

  // Tô màu khu theo hạng vé
  useLayoutEffect(() => {
    const root = svgRef.current;
    if (!root) return;
    root.querySelectorAll('[id^="STAGE_"]').forEach((el) => {
      const shapes = el.matches(SHAPES) ? [el] : el.querySelectorAll(SHAPES);
      shapes.forEach((n) => n.style.setProperty("fill", "#a1a1aa", "important"));
    });
    root.querySelectorAll('[id^="SEC_"]').forEach((el) => {
      const sec = byId.get(el.id);
      const off = !sec || sec.status !== "AVAILABLE";
      const dim = Boolean(highlightTierId) && String(sec?.tierId) !== String(highlightTierId);
      const picked = (selectedCount[el.id] || 0) > 0;
      const shapes = el.matches(SHAPES) ? [el] : el.querySelectorAll(SHAPES);
      shapes.forEach((n) => {
        n.style.setProperty("fill", off ? "#d4d4d8" : sec.color, "important");
        n.style.setProperty("opacity", off ? "0.55" : dim ? "0.25" : "1", "important");
        n.style.setProperty("stroke", picked ? "#09090b" : "#ffffff", "important");
        n.style.setProperty("stroke-width", picked ? "4" : "1.5", "important");
      });
      el.style.cursor = sec?.type === "GA" && !off ? "pointer" : "default";
      el.classList.add("sm-sec");
    });
  }, [html, byId, selectedCount, highlightTierId]);

  const secOf = (target) => {
    const el = target.closest?.('[id^="SEC_"]');
    return el ? byId.get(el.id) : null;
  };
  const showSeatTip = (e, seat, sec) => setTip({ x: e.clientX, y: e.clientY, seat, sec });

  return (
    <div
      ref={attach}
      className={`sm-stage ${dragging ? "dragging" : ""}`}
      {...panHandlers}
      onMouseLeave={() => {
        panHandlers.onMouseLeave();
        setTip(null);
      }}
    >
      <div className="sm-ctrls">
        <button type="button" onClick={zoomIn} title="Phóng to">+</button>
        <button type="button" onClick={resetView} title="Đặt lại">⟳</button>
        <button type="button" onClick={zoomOut} title="Thu nhỏ">−</button>
      </div>

      <div className="sm-svg" style={panStyle}>
        <div className="sm-svg-wrap">
          <div
            ref={svgRef}
            onMouseMove={(e) => {
              if (e.target.closest?.(".sm-seat-dot")) return;
              const sec = secOf(e.target);
              setTip(sec && !dragging ? { x: e.clientX, y: e.clientY, sec } : null);
            }}
            onClick={(e) => {
              if (wasDragged()) return;
              const sec = secOf(e.target);
              if (sec && sec.type === "GA" && sec.status === "AVAILABLE") onSelectSection(sec);
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {layout.vb && (
            <svg className="sm-seat-layer" viewBox={layout.vb} preserveAspectRatio="xMidYMid meet">
              {sections.map((sec) => {
                const placed = layout.bySection[sec.sectionId];
                if (!placed) return null;
                return (seatsBySection.get(sec.sectionId) || []).map((seat) => {
                  const p = placed.positions.get(String(seat._id));
                  if (!p) return null;
                  const picked = selectedSeatIds.has(String(seat._id));
                  const state = picked ? "selected" : seat.status === "AVAILABLE" ? "available" : "unavailable";
                  return (
                    <circle
                      key={seat._id}
                      className={`sm-seat-dot ${state}`}
                      cx={p.x}
                      cy={p.y}
                      r={picked ? placed.radius * 1.15 : placed.radius}
                      opacity={highlightTierId && String(sec.tierId) !== String(highlightTierId) ? 0.25 : 1}
                      onMouseMove={(e) => !dragging && showSeatTip(e, seat, sec)}
                      onMouseLeave={() => setTip(null)}
                      onClick={() => {
                        if (wasDragged() || state === "unavailable") return;
                        onToggleSeat({ ...seat, tierId: seat.tierId || sec.tierId });
                      }}
                    />
                  );
                });
              })}
            </svg>
          )}
        </div>
      </div>

      {tip && (
        <div className="sm-tip" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          {tip.seat ? (
            <>
              <div className="sm-tip-title">
                <i style={{ background: tip.sec.color }} />
                {tip.sec.name} · Hàng {tip.seat.row} · Ghế {tip.seat.number}
              </div>
              <div>{tip.sec.tierName} · {money(tip.sec.price)}</div>
              <div className={tip.seat.status === "AVAILABLE" ? "" : "sm-tip-off"}>
                {selectedSeatIds.has(String(tip.seat._id))
                  ? "Đang chọn (bấm để bỏ)"
                  : tip.seat.status === "AVAILABLE"
                    ? "Còn trống (bấm để chọn)"
                    : "Không chọn được"}
              </div>
            </>
          ) : (
            <>
              <div className="sm-tip-title">
                <i style={{ background: tip.sec.color }} />
                {tip.sec.name}
              </div>
              <div>{tip.sec.tierName} · {money(tip.sec.price)}</div>
              <div className={tip.sec.status === "AVAILABLE" ? "" : "sm-tip-off"}>
                {tip.sec.status === "SOLD_OUT"
                  ? "Hết vé"
                  : tip.sec.status === "UNAVAILABLE"
                    ? "Chưa mở bán"
                    : `Còn ${tip.sec.available}/${tip.sec.total} ${tip.sec.type === "GA" ? "vé" : "ghế"}`}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
