-- Viprosell — luồng rút hoa hồng affiliate
--
-- Vì sao cần bảng này: hoa hồng được ghi vào affiliate_events với 4 trạng thái
-- pending|approved|paid|rejected, nhưng không có chỗ nào lưu YÊU CẦU RÚT của đối tác.
-- Hệ quả trước đây: hoa hồng cứ tích lại, đối tác không có cách nào lấy tiền ra.
--
-- Quan hệ: một yêu cầu rút gộp nhiều affiliate_events đang ở trạng thái 'approved'.
-- Khi yêu cầu được trả xong, các event đó chuyển sang 'paid'.

CREATE TABLE IF NOT EXISTS public.affiliate_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Đối tác yêu cầu rút
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  amount_vnd NUMERIC(12, 2) NOT NULL CHECK (amount_vnd > 0),

  -- requested: đối tác vừa gửi
  -- approved : đã duyệt, đang chờ chuyển khoản
  -- paid     : đã chuyển tiền
  -- rejected : từ chối (lý do ở cột note)
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'paid', 'rejected')),

  -- Thông tin nhận tiền do đối tác nhập. Lưu jsonb để sau này thêm ví điện tử
  -- mà không phải đổi schema: { bank, account_no, account_name }
  payout_account JSONB NOT NULL,

  note TEXT,

  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES public.profiles(id),

  meta JSONB
);

-- Tra lịch sử rút của một đối tác, mới nhất trước.
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_referrer
  ON public.affiliate_withdrawals (referrer_id, requested_at DESC);

-- Trang quản trị lọc theo trạng thái để xử lý hàng chờ.
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_status
  ON public.affiliate_withdrawals (status, requested_at);

-- Mỗi đối tác chỉ được có MỘT yêu cầu đang xử lý tại một thời điểm.
-- Không có ràng buộc này thì bấm nút hai lần là tạo hai yêu cầu cho cùng số dư.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_affiliate_withdrawal_open
  ON public.affiliate_withdrawals (referrer_id)
  WHERE status IN ('requested', 'approved');

ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;

-- Đối tác xem được yêu cầu của chính mình.
DROP POLICY IF EXISTS "affiliate reads own withdrawals" ON public.affiliate_withdrawals;
CREATE POLICY "affiliate reads own withdrawals"
  ON public.affiliate_withdrawals
  FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid());

-- Việc TẠO yêu cầu đi qua backend (service role) chứ không cho client tự insert:
-- backend phải kiểm số dư khả dụng và ngưỡng tối thiểu trước khi ghi.
-- Service role bỏ qua RLS nên không cần policy riêng cho nó.
