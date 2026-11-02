import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Bắt lỗi lúc render để màn hình không trắng trơn.
 *
 * ── Vì sao cần ──
 *
 * React huỷ toàn bộ cây khi một component ném lỗi lúc render và không có ranh giới
 * nào bắt. Kết quả là **trang trắng hoàn toàn**: không khung ứng dụng, không thông
 * báo, không gì cả. Khách không biết phải làm gì, và người sửa thì không có manh mối
 * nào ngoài việc mở console.
 *
 * Đã xảy ra hai lần trong ngày 29/10/2026 — trang `/affiliate` đọc `data.tier` phía
 * trên guard `isLoading`, và trang `/projects/:id/script`. Cả hai lần đều mất nhiều
 * lượt đoán mới tìm ra, vì không có gì hiện lên để đọc.
 *
 * Ranh giới này không sửa được lỗi. Nó biến "trắng trơn, bó tay" thành "có thông báo,
 * có nút tải lại, và có nội dung lỗi để gửi đi" — đủ để lần sau mất một lượt thay vì
 * năm lượt.
 */

interface Props {
  children: ReactNode;
  /** Tên khu vực, hiện trong thông báo để biết chỗ nào hỏng. */
  khuVuc?: string;
}

interface State {
  loi: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { loi: null };

  static getDerivedStateFromError(loi: Error): State {
    return { loi };
  }

  componentDidCatch(loi: Error, thongTin: ErrorInfo) {
    // Log đầy đủ để còn dán đi được. `componentStack` cho biết component nào ném.
    console.error(
      `[ErrorBoundary] Lỗi lúc render${this.props.khuVuc ? ` tại ${this.props.khuVuc}` : ''}:`,
      loi,
      thongTin.componentStack
    );
  }

  render() {
    const { loi } = this.state;
    if (!loi) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-xl border border-destructive/40 bg-card p-6 space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-foreground">Trang này gặp lỗi</h2>
            <p className="text-sm text-muted-foreground">
              Dữ liệu của bạn vẫn an toàn. Thử tải lại trang; nếu vẫn lỗi, gửi cho chúng
              tôi nội dung bên dưới.
            </p>
          </div>

          {/* Hiện nội dung lỗi ngay trên màn hình, không bắt người dùng mở console.
              Phần lớn người bán hàng không biết console là gì. */}
          <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-auto max-h-40 text-muted-foreground whitespace-pre-wrap break-words">
            {loi.message}
          </pre>

          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
            >
              Tải lại trang
            </button>
            <button
              onClick={() => { window.location.href = '/dashboard'; }}
              className="rounded-lg border border-border px-4 py-2 text-sm"
            >
              Về Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}
