/**
 * Canh việc render quick-ads LUÔN có chủ sở hữu.
 *
 * ── Lỗ được vá ngày 02/11/2026 ──
 *
 * `startRender` chèn vào `renders` mà không đặt `project_id`. Bảng `renders` không có cột
 * `user_id` — quyền sở hữu đi qua `project_id → projects.user_id` — nên dòng không dự án
 * là dòng KHÔNG AI kiểm được quyền. `GET /quick-ads/status/:jobId` vì thế trả trạng thái
 * và `output_url` của bất kỳ job nào cho bất kỳ người đã đăng nhập nào.
 *
 * Hai trang công cụ `ShopeeToVideo` và `ImagesToVideo` chỉ gửi `product_url` kèm token,
 * không tạo dự án nào, nên backend phải tạo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuickAdsRenderService, tieuDeQuickAds } from '../src/services/quick-ads-render.service';

// ───────────────────────── Chốt chặn projectId ─────────────────────────

test('startRender KHONG tao job khi thieu projectId', async () => {
  // Chot nay dung truoc moi thu khac, ke ca truoc phep kiem anh — thieu projectId la
  // loi cua NGUOI GOI, va bao dung loi do thi nguoi sua khoi di tim sai cho.
  for (const xau of ['', undefined as any, null as any]) {
    const ra = await QuickAdsRenderService.startRender(
      { product_title: 'Ao thun', product_summary: 'x', image_urls: ['a', 'b', 'c'] },
      xau,
    );
    assert.equal(ra.status, 'failed', `voi projectId=${JSON.stringify(xau)}`);
    assert.match(String(ra.error), /projectId la bat buoc/);
  }
});

test('startRender tra ve job_id ngay ca khi tu choi — de nguoi goi log duoc', async () => {
  const ra = await QuickAdsRenderService.startRender(
    { product_title: 'x', product_summary: 'x', image_urls: ['a', 'b', 'c'] },
    '',
  );
  assert.ok(ra.job_id, 'Thieu job_id thi khong doi chieu duoc voi log');
});

test('chot projectId dung TRUOC chot anh — bao loi cua nguoi goi, khong bao loi cua khach', async () => {
  // Ca hai sai: thieu projectId VA thieu anh. Phai bao projectId, vi do la loi lap trinh;
  // bao "can it nhat 3 anh" se lam nguoi dung tuong minh lam sai.
  const ra = await QuickAdsRenderService.startRender(
    { product_title: 'x', product_summary: 'x', image_urls: [] },
    '',
  );
  assert.match(String(ra.error), /projectId/);
  assert.doesNotMatch(String(ra.error), /3 anh/);
});

// ───────────────────────── Tiêu đề dự án ─────────────────────────

test('tieu de lay ten san pham khi co', () => {
  assert.equal(
    tieuDeQuickAds({ product_title: 'Ao thun co tron' }),
    'Quick Ads — Ao thun co tron',
  );
});

test('tieu de lui ve ten mien khi khong co ten san pham', () => {
  assert.equal(
    tieuDeQuickAds({ product_url: 'https://shopee.vn/ao-thun-i.123.456' }),
    'Quick Ads — shopee.vn',
  );
});

test('tieu de lui ve nhan chung khi khong co gi — khong bao gio tro ten', () => {
  for (const x of [{}, { product_title: '' }, { product_title: '   ' }, { product_url: '' }]) {
    assert.equal(tieuDeQuickAds(x), 'Quick Ads — khong ten', `voi ${JSON.stringify(x)}`);
  }
});

test('duong dan hong KHONG lam vo — lui ve nhan chung', () => {
  // `new URL()` nem loi voi chuoi khong phai URL. Nem o day la lam that bai ca lenh
  // tao du an, tuc khach khong dung duoc video chi vi mot duong dan go sai.
  for (const xau of ['khong-phai-url', 'http://', '://abc', 'shopee.vn/ao-thun']) {
    assert.equal(tieuDeQuickAds({ product_url: xau }), 'Quick Ads — khong ten', `voi "${xau}"`);
  }
});

test('ten san pham duoc uu tien hon duong dan', () => {
  assert.equal(
    tieuDeQuickAds({ product_title: 'Ao khoac', product_url: 'https://shopee.vn/x' }),
    'Quick Ads — Ao khoac',
  );
});

test('tieu de khong bao gio vuot 200 ky tu', () => {
  // Ten san pham tren Shopee thuong rat dai; tieu de dai lam vo bo cuc danh sach du an.
  const dai = 'A'.repeat(500);
  const ra = tieuDeQuickAds({ product_title: dai });
  assert.equal(ra.length, 200);
  assert.ok(ra.startsWith('Quick Ads — '));
});

test('tieu de cat khoang trang hai dau cua ten san pham', () => {
  assert.equal(tieuDeQuickAds({ product_title: '  Ao thun  ' }), 'Quick Ads — Ao thun');
});
