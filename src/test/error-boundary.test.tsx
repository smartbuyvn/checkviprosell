/**
 * Lỗi lúc render phải HIỆN RA, không được xoá trắng màn hình.
 *
 * ── Vì sao cần ──
 *
 * React huỷ toàn bộ cây khi một component ném lỗi lúc render mà không có ranh giới
 * nào bắt. Kết quả là trang trắng trơn: không khung ứng dụng, không thông báo.
 *
 * Xảy ra hai lần ngày 29/10/2026 — `/affiliate` đọc `data.tier` phía trên guard
 * `isLoading`, và `/projects/:id/script`. Cả hai lần đều mất nhiều lượt đoán mới tìm
 * ra, vì không có gì hiện lên để đọc.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

function Nổ({ loi = 'Cannot read properties of null' }: { loi?: string }): JSX.Element {
  throw new Error(loi);
}

function Thuong() {
  return <div>nội dung bình thường</div>;
}

afterEach(cleanup);

describe('ErrorBoundary', () => {
  it('component bình thường vẫn hiện như cũ', () => {
    render(<ErrorBoundary><Thuong /></ErrorBoundary>);
    expect(screen.getByText('nội dung bình thường')).toBeTruthy();
  });

  it('component nổ thì hiện thông báo, KHÔNG trắng trang', () => {
    // React in lỗi ra console khi boundary bắt — che đi cho đỡ nhiễu.
    const im = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Nổ /></ErrorBoundary>);
    expect(screen.getByText('Trang này gặp lỗi')).toBeTruthy();
    im.mockRestore();
  });

  it('hiện NỘI DUNG lỗi trên màn hình, không bắt người dùng mở console', () => {
    // Phần lớn người bán hàng không biết console là gì. Có chữ để dán đi là khác biệt
    // giữa "sửa trong một lượt" và "đoán năm lượt".
    const im = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Nổ loi="project.package_type là null" /></ErrorBoundary>);
    expect(screen.getByText(/project\.package_type là null/)).toBeTruthy();
    im.mockRestore();
  });

  it('có nút tải lại và nút về Dashboard', () => {
    const im = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Nổ /></ErrorBoundary>);
    expect(screen.getByText('Tải lại trang')).toBeTruthy();
    expect(screen.getByText('Về Dashboard')).toBeTruthy();
    im.mockRestore();
  });

  it('ghi log kèm tên khu vực để biết chỗ nào hỏng', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary khuVuc="trang script"><Nổ /></ErrorBoundary>);
    const coKhuVuc = log.mock.calls.some((c) => String(c[0]).includes('trang script'));
    expect(coKhuVuc, 'Log phải nêu khu vực').toBe(true);
    log.mockRestore();
  });
});
