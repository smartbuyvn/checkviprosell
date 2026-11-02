/**
 * Viprosell — Mẫu thư giao dịch
 *
 * Hàm thuần, không I/O: nội dung thư là thứ khách đọc và là thứ dễ sai nhất (số tiền,
 * số credit, tên gói), nên nó phải test được mà không cần gửi thật.
 *
 * Viết cho người bán hàng, không phải cho lập trình viên. Mỗi thư trả lời đúng ba câu
 * họ hỏi khi mở hộp thư: việc gì vừa xảy ra, nó ảnh hưởng gì tới tôi, và tôi làm gì tiếp.
 *
 * HTML giữ ở mức bảng và thẻ đơn giản: hộp thư điện tử cắt bỏ CSS hiện đại, flexbox và
 * grid đều không dùng được. Thà xấu đều ở mọi nơi còn hơn đẹp ở một nơi và vỡ ở chỗ khác.
 */

const MAU_CHINH = '#F26B1D';
const MAU_CHU = '#1a1a1a';
const MAU_PHU = '#666666';

function dinhDangTien(vnd: number): string {
  return `${Math.round(vnd).toLocaleString('vi-VN')}₫`;
}

/** Khung ngoài dùng chung. `noiDung` là HTML phần thân. */
function khung(tieuDe: string, noiDung: string, nutChinh?: { chu: string; link: string }): string {
  const nut = nutChinh
    ? `<tr><td style="padding:8px 0 24px 0;">
         <a href="${nutChinh.link}"
            style="display:inline-block;background:${MAU_CHINH};color:#ffffff;text-decoration:none;
                   padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px;">
           ${nutChinh.chu}
         </a>
       </td></tr>`
    : '';

  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px 12px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;">
    <tr><td style="padding:28px 28px 0 28px;">
      <div style="font-size:18px;font-weight:700;color:${MAU_CHINH};margin-bottom:20px;">ViproSell</div>
      <h1 style="margin:0 0 16px 0;font-size:20px;line-height:1.35;color:${MAU_CHU};">${tieuDe}</h1>
    </td></tr>
    <tr><td style="padding:0 28px;color:${MAU_CHU};font-size:15px;line-height:1.6;">${noiDung}</td></tr>
    <tr><td style="padding:0 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0">${nut}</table>
    </td></tr>
    <tr><td style="padding:8px 28px 28px 28px;border-top:1px solid #eeeeee;color:${MAU_PHU};font-size:12px;line-height:1.5;">
      Thư này được gửi tự động từ ViproSell. Nếu bạn không thực hiện giao dịch này, trả lời thư để báo cho chúng tôi.
    </td></tr>
  </table>
</body></html>`;
}

export interface ThuThanhToan {
  tenGoi: string;
  soTien: number;
  creditNhan: number;
  soDuSau: number;
  /** Credit thưởng thêm vì có người giới thiệu. 0 nghĩa là không có. */
  creditThuong?: number;
  linkBangDieuKhien: string;
}

/**
 * Thư báo thanh toán thành công.
 *
 * Đây là thư quan trọng nhất: khách vừa chuyển tiền và đang chờ xác nhận. Nêu SỐ DƯ
 * SAU GIAO DỊCH chứ không chỉ số credit vừa cộng — đó là con số họ thật sự muốn biết.
 */
export function thuThanhToanThanhCong(d: ThuThanhToan): { subject: string; html: string } {
  const thuong = (d.creditThuong ?? 0) > 0
    ? `<tr><td style="padding:4px 0;color:${MAU_PHU};">Thưởng giới thiệu</td>
       <td style="padding:4px 0;text-align:right;color:#16a34a;font-weight:600;">+${d.creditThuong} credit</td></tr>`
    : '';

  return {
    subject: `Đã nhận thanh toán — gói ${d.tenGoi} đã kích hoạt`,
    html: khung(
      `Thanh toán thành công`,
      `<p style="margin:0 0 16px 0;">Gói <strong>${d.tenGoi}</strong> của bạn đã được kích hoạt. Credit đã vào tài khoản và dùng được ngay.</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;font-size:14px;">
         <tr><td style="padding:4px 0;color:${MAU_PHU};">Số tiền</td>
             <td style="padding:4px 0;text-align:right;font-weight:600;">${dinhDangTien(d.soTien)}</td></tr>
         <tr><td style="padding:4px 0;color:${MAU_PHU};">Credit nhận được</td>
             <td style="padding:4px 0;text-align:right;font-weight:600;">+${d.creditNhan} credit</td></tr>
         ${thuong}
         <tr><td style="padding:10px 0 4px 0;border-top:1px solid #eeeeee;color:${MAU_CHU};font-weight:600;">Số dư hiện tại</td>
             <td style="padding:10px 0 4px 0;border-top:1px solid #eeeeee;text-align:right;font-weight:700;font-size:16px;">${d.soDuSau} credit</td></tr>
       </table>`,
      { chu: 'Tạo video ngay', link: d.linkBangDieuKhien }
    ),
  };
}

export interface ThuVideoXong {
  tenVideo: string;
  linkVideo: string;
  soCreditDaTru: number;
  soDuSau: number;
  /** Số ngày video còn được lưu trên máy chủ. */
  soNgayLuu: number;
}

/**
 * Thư báo video đã dựng xong.
 *
 * Nêu rõ hạn lưu trữ: video bị xoá sau 30 ngày, và khách không biết điều đó cho tới
 * khi link chết. Nói trước thì họ tải về; nói sau thì họ mất.
 */
export function thuVideoDaXong(d: ThuVideoXong): { subject: string; html: string } {
  return {
    subject: `Video "${d.tenVideo}" đã xong`,
    html: khung(
      `Video của bạn đã dựng xong`,
      `<p style="margin:0 0 16px 0;"><strong>${d.tenVideo}</strong> đã sẵn sàng để tải về và đăng.</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;font-size:14px;">
         <tr><td style="padding:4px 0;color:${MAU_PHU};">Credit đã dùng</td>
             <td style="padding:4px 0;text-align:right;font-weight:600;">${d.soCreditDaTru} credit</td></tr>
         <tr><td style="padding:4px 0;color:${MAU_PHU};">Số dư còn lại</td>
             <td style="padding:4px 0;text-align:right;font-weight:600;">${d.soDuSau} credit</td></tr>
       </table>
       <p style="margin:0 0 16px 0;padding:12px;background:#fff7ed;border-radius:8px;font-size:14px;line-height:1.5;">
         Video được lưu <strong>${d.soNgayLuu} ngày</strong> rồi xoá khỏi máy chủ. Tải về máy nếu bạn muốn giữ lâu hơn.
       </p>`,
      { chu: 'Xem và tải video', link: d.linkVideo }
    ),
  };
}

export interface ThuRutTien {
  soTien: number;
  trangThai: 'requested' | 'approved' | 'paid' | 'rejected';
  ghiChu?: string;
  linkDoiTac: string;
}

/** Thư báo trạng thái yêu cầu rút hoa hồng. */
export function thuRutHoaHong(d: ThuRutTien): { subject: string; html: string } {
  const theo = {
    requested: {
      tieuDe: 'Đã nhận yêu cầu rút hoa hồng',
      than: `Chúng tôi đã nhận yêu cầu rút <strong>${dinhDangTien(d.soTien)}</strong> và đang soát xét. Bạn sẽ nhận thư tiếp theo khi có kết quả.`,
    },
    approved: {
      tieuDe: 'Yêu cầu rút đã được duyệt',
      than: `Yêu cầu rút <strong>${dinhDangTien(d.soTien)}</strong> đã được duyệt. Tiền sẽ được chuyển tới tài khoản bạn đăng ký.`,
    },
    paid: {
      tieuDe: 'Đã chuyển tiền hoa hồng',
      than: `Chúng tôi đã chuyển <strong>${dinhDangTien(d.soTien)}</strong> tới tài khoản bạn đăng ký. Kiểm tra lại giúp chúng tôi nhé.`,
    },
    rejected: {
      tieuDe: 'Yêu cầu rút không được duyệt',
      than: `Yêu cầu rút <strong>${dinhDangTien(d.soTien)}</strong> chưa được duyệt lần này. Số tiền vẫn nằm nguyên trong tài khoản đối tác của bạn.`,
    },
  }[d.trangThai];

  const ghiChu = d.ghiChu
    ? `<p style="margin:0 0 16px 0;padding:12px;background:#f5f5f5;border-radius:8px;font-size:14px;">${d.ghiChu}</p>`
    : '';

  return {
    subject: theo.tieuDe,
    html: khung(theo.tieuDe, `<p style="margin:0 0 16px 0;">${theo.than}</p>${ghiChu}`,
      { chu: 'Xem trang đối tác', link: d.linkDoiTac }),
  };
}
