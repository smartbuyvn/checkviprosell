/**
 * Giá báo cho khách trước khi dựng.
 *
 * Test này canh phía giao diện; việc hai bản frontend/backend có khớp nhau không thì
 * `backend/tests/credit-cost-sync.test.ts` lo, vì chỉ bên đó nạp được cả hai.
 *
 * Điều quan trọng nhất ở đây: con số hiện trên màn hình phải GIẢI THÍCH ĐƯỢC. Khách
 * hỏi "sao trừ 2 credit" mà câu trả lời nằm trong log của chúng ta thì vô dụng.
 *
 * ── Cập nhật 02/11/2026: test này từng ĐỎ vì mã hoá bảng giá đã bỏ ──
 *
 * Bốn phép kiểm dưới đây trước đây tính theo luật trước 30/10: 20 giây = 1 credit,
 * cộng 1 nếu có giọng đọc, cộng 1 nếu 1080p, rồi mỗi 20 giây vượt mốc cộng 1.
 *
 * Bảng giá chốt 30/10 (migration 20261030000002_bang_gia_theo_thoi_luong.sql) đổi
 * sang **1 credit cho mỗi 15 giây bắt đầu, không phụ phí gì khác** — giọng đọc và
 * 1080p thành QUYỀN CỦA GÓI, không còn là phụ phí mỗi lần dựng. Mã đã đổi theo, test
 * thì không, nên nó đỏ suốt từ đó. Đây đúng là mẫu lỗi "hai nơi lệch nhau" của dự án.
 */
import { describe, it, expect } from 'vitest';
import { creditsFor, giaiThichCredit, specFromChoices } from '@/lib/creditCost';

describe('Giá credit cho một lần dựng', () => {
  it('video 20 giây là 2 credit — 1 credit cho mỗi 15 giây BẮT ĐẦU', () => {
    const spec = specFromChoices({ durationSec: 20, renderMode: 'draft_local' });
    expect(creditsFor(spec)).toBe(2);
  });

  it('giọng đọc KHÔNG còn là phụ phí — cùng thời lượng thì cùng giá', () => {
    const khong = creditsFor(specFromChoices({ durationSec: 20, renderMode: 'draft_local' }));
    const co = creditsFor(specFromChoices({ durationSec: 20, renderMode: 'draftlocaltts' }));
    expect(co).toBe(khong);
  });

  it('1080p KHÔNG còn là phụ phí — premium cùng giá với nháp', () => {
    const nhap = creditsFor(specFromChoices({ durationSec: 20, renderMode: 'draft_local' }));
    const premium = creditsFor(specFromChoices({ durationSec: 20, renderMode: 'premiumcloud' }));
    expect(premium).toBe(nhap);
  });

  it('nhận cả dạng tên của CSDL, không chỉ dạng của giao diện', () => {
    // Nhầm dạng ở đây nghĩa là spec đi tiếp với chế độ sai mà không ai nhận ra.
    const dangUI = specFromChoices({ durationSec: 20, renderMode: 'draftlocaltts' });
    const dangDb = specFromChoices({ durationSec: 20, renderMode: 'draft_local_tts' });
    expect(dangDb).toEqual(dangUI);
  });

  it('mỗi 15 giây BẮT ĐẦU cộng thêm 1', () => {
    const gia = (s: number) => creditsFor(specFromChoices({ durationSec: s, renderMode: 'draft_local' }));
    expect(gia(15)).toBe(1);
    expect(gia(16)).toBe(2);
    expect(gia(30)).toBe(2);
    expect(gia(31)).toBe(3);
    expect(gia(45)).toBe(3);
    expect(gia(60)).toBe(4);
  });

  it('20 giây và 30 giây cùng giá — đây là lý do nên bỏ mốc 20 giây khỏi giao diện', () => {
    // Không phải lỗi, mà là hệ quả của mốc 15 giây. Ghi lại ở đây để lần sau ai thấy
    // cũng biết là CÓ CHỦ Ý: cùng giá thì không khách nào chọn 20 giây.
    const g = (s: number) => creditsFor(specFromChoices({ durationSec: s, renderMode: 'draft_local' }));
    expect(g(20)).toBe(g(30));
  });

  it('không bao giờ trả 0 — 0 nghĩa là dựng miễn phí không giới hạn', () => {
    for (const xau of [null, undefined, {}, { durationSec: NaN }, { durationSec: -5 }]) {
      expect(creditsFor(xau as never)).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('Lời giải thích hiện cho khách', () => {
  it('tổng các dòng luôn bằng số credit bị trừ', () => {
    for (const mode of ['draft_local', 'draftlocaltts', 'premiumcloud']) {
      for (const giay of [20, 25, 45, 60]) {
        const spec = specFromChoices({ durationSec: giay, renderMode: mode });
        const tong = giaiThichCredit(spec).reduce((t, d) => t + d.credit, 0);
        expect(tong, `lệch ở ${mode} ${giay}s`).toBe(creditsFor(spec));
      }
    }
  });

  it('luôn có ít nhất dòng video chuẩn, kể cả khi spec rỗng', () => {
    // Spec rỗng lấy BASE_DURATION_SEC = 20 giây, nên ra 2 credit.
    const dong = giaiThichCredit({});
    expect(dong.length).toBeGreaterThanOrEqual(1);
    expect(dong[0].credit).toBe(creditsFor({}));
  });

  it('không hiện dòng phụ phí nào khi khách chọn gói rẻ nhất', () => {
    const dong = giaiThichCredit(specFromChoices({ durationSec: 20, renderMode: 'draft_local' }));
    expect(dong).toHaveLength(1);
  });
});
