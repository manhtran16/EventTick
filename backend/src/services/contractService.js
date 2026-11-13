const crypto = require("crypto");
const path = require("path");
const PDFDocument = require("pdfkit");
const { esc } = require("../utils/http");

const FONT_DIR = path.join(path.dirname(require.resolve("dejavu-fonts-ttf/package.json")), "ttf");

const fmtDate = (d) => new Date(d).toLocaleString("vi-VN", { hour12: false });

/** Văn bản thuần (từ người dùng) -> HTML an toàn: escape toàn bộ, xuống dòng thành <p> */
function plainToHtml(text) {
  return String(text || "")
    .split(/\n{1,}/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${esc(l)}</p>`)
    .join("");
}

/**
 * Sinh điều khoản hợp đồng. Mọi dữ liệu động đều được escape nên HTML trả về an toàn khi hiển thị.
 * Tỷ lệ hoa hồng nằm trong <strong data-commission> để Admin đổi sau mà không phải sinh lại cả hợp đồng.
 */
function buildTermsHtml({ event, sessions, profile, commission, customTerms }) {
  const sessionLines = sessions
    .map((s) => `<li>${esc(s.name)}: ${esc(fmtDate(s.start_time))} – ${esc(fmtDate(s.end_time))}</li>`)
    .join("");
  return [
    "<h3>HỢP ĐỒNG DỊCH VỤ PHÂN PHỐI VÉ SỰ KIỆN</h3>",
    `<p><b>Bên A (Sàn EventTick)</b> cung cấp nền tảng bán vé trực tuyến cho <b>Bên B (Nhà tổ chức)</b>: ${esc(profile.organization_name)} – MST ${esc(profile.tax_code)}.</p>`,
    `<p><b>Sự kiện:</b> ${esc(event.title)} tại ${esc(event.venue_name)}, ${esc(event.city)}.</p>`,
    `<p><b>Các suất diễn:</b></p><ul>${sessionLines}</ul>`,
    "<p><b>Điều 1. Phí dịch vụ.</b> Bên A thu phí hoa hồng <strong data-commission>" +
      Number(commission).toFixed(2) +
      "%</strong> trên doanh thu bán vé thực thu (sau khi trừ các khoản hoàn tiền).</p>",
    "<p><b>Điều 2. Đối soát.</b> Sau khi sự kiện kết thúc, Bên A đối soát doanh thu và chuyển khoản phần còn lại vào tài khoản ngân hàng đã đăng ký của Bên B.</p>",
    "<p><b>Điều 3. Hoàn tiền.</b> Người mua không được hoàn vé lẻ; vé chỉ được chuyển nhượng qua Chợ vé bán lại. Khi sự kiện bị hủy, Bên A hoàn tiền cho người mua và trừ vào doanh thu của Bên B.</p>",
    "<p><b>Điều 4. Trách nhiệm.</b> Bên B chịu trách nhiệm về tính pháp lý của sự kiện và giấy phép tổ chức đã cung cấp.</p>",
    customTerms ? `<p><b>Điều khoản bổ sung:</b></p>${plainToHtml(customTerms)}` : "",
  ].join("");
}

const stripAdminSignature = (html) =>
  String(html || "").replace(
    /<p><b>ĐẠI DIỆN BÊN A \(SÀN EVENTTICK\)<\/b><br\/>Chữ ký: <em>Dương<\/em><br\/>Họ và tên: Bùi Tuấn Dương<\/p>/g,
    "",
  );

const withCommission = (html, commission) =>
  html.replace(/<strong data-commission>[^<]*<\/strong>/g, `<strong data-commission>${Number(commission).toFixed(2)}%</strong>`);

function htmlToText(html) {
  return String(html || "")
    .replace(/<\/(p|h\d|li|ul)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Mã băm gắn với nội dung hợp đồng tại thời điểm ký (chống sửa điều khoản sau khi ký). */
function contractHash({ contract, signedAt }) {
  return crypto
    .createHash("sha256")
    .update([contract._id, contract.event_id, contract.organizer_id, contract.commission_rate_pct, contract.contract_terms_html, new Date(signedAt).toISOString()].join("|"))
    .digest("hex");
}

/** Xuất PDF hợp đồng đã ký (Buffer). Dùng font DejaVu để có dấu tiếng Việt. */
function buildSignedPdf({ contract, event, profile, signaturePng, signerIp, signedAt }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: `Hop dong ${contract._id}`, Author: "EventTick" } });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("vn", path.join(FONT_DIR, "DejaVuSans.ttf"));
    doc.registerFont("vn-bold", path.join(FONT_DIR, "DejaVuSans-Bold.ttf"));

    doc.font("vn-bold").fontSize(15).text("HỢP ĐỒNG ĐIỆN TỬ", { align: "center" });
    doc.moveDown(0.3).font("vn").fontSize(9).fillColor("#555").text(`Mã hợp đồng: ${contract._id}`, { align: "center" });
    doc.fillColor("#000").moveDown();

    doc.font("vn").fontSize(10.5).text(htmlToText(stripAdminSignature(contract.contract_terms_html)), { align: "left", lineGap: 3 });
    doc.moveDown(1.5);

    if (doc.y > 620) doc.addPage();
    const signatureTop = doc.y;
    doc.font("vn-bold").fontSize(11).text("ĐẠI DIỆN BÊN A (SÀN EVENTTICK)", 50, signatureTop, { width: 240 });
    doc.text("ĐẠI DIỆN BÊN B (NHÀ TỔ CHỨC)", 320, signatureTop, { width: 240 });
    doc.font("vn").fontSize(18).text("Dương", 50, signatureTop + 28, { width: 240 });
    doc.fontSize(10).text("Bùi Tuấn Dương", 50, signatureTop + 58, { width: 240 });
    doc.fontSize(10).text(`${profile.organization_name} – MST ${profile.tax_code}`, 320, signatureTop + 28, { width: 240 });
    doc.image(signaturePng, { fit: [180, 80], x: 350, y: signatureTop + 48 });
    doc.y = signatureTop + 145;

    doc.fontSize(8.5).fillColor("#444");
    doc.text(`Thời điểm ký: ${fmtDate(signedAt)}`);
    doc.text(`Địa chỉ IP người ký: ${signerIp || "không xác định"}`);
    doc.text(`Mã băm SHA-256: ${contractHash({ contract, signedAt })}`, { lineGap: 2 });
    doc.end();
  });
}

module.exports = { buildTermsHtml, stripAdminSignature, withCommission, htmlToText, buildSignedPdf, contractHash, plainToHtml };
