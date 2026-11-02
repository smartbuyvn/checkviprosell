-- ============================================================
-- Sinh mã giới thiệu cho MỌI tài khoản — chốt 28/10/2026
--
-- Vì sao cần: `handle_new_user()` chèn profile mà không đặt `affiliate_code`,
-- nên cột này NULL với toàn bộ người dùng từ ngày đầu. Giao diện đối tác hiện
-- link "…/signup?ref=" bỏ trống, và `webhooks.ts` tra `.eq('affiliate_code', …)`
-- không bao giờ khớp. Tức là chương trình affiliate CHƯA TỪNG quy được một giao
-- dịch nào về ai cả — không phải lỗi hiển thị, mà là không có dữ liệu.
--
-- Dạng mã: 'vipro' + 6 ký tự, ví dụ `viproh7k2mq`.
--
--   - Tiền tố thương hiệu để mã tự nhận dạng khi được dán ở chỗ khác.
--   - 6 ký tự NGẪU NHIÊN, không phải số tăng dần. Mã tuần tự kiểu `…105255`
--     tiết lộ số người dùng thật cho bất kỳ ai nhìn thấy một mã — đó là số liệu
--     kinh doanh, không nên phát ra ngoài kèm mỗi link giới thiệu.
--   - Bảng chữ bỏ 0/O và 1/l/i: mã này được đọc qua điện thoại và gõ tay.
--   - Không gian 31^6 ≈ 887 triệu. Vẫn kiểm trùng trong vòng lặp, vì chỉ số UNIQUE
--     mà vỡ thì cả lần đăng ký hỏng theo.
--
-- Chạy lại nhiều lần đều an toàn.
-- ============================================================


-- ─── 1. Hàm sinh mã ───
--
-- SECURITY DEFINER vì nó đọc `profiles` để kiểm trùng, trong khi người gọi (trigger
-- lúc đăng ký) chưa chắc có quyền SELECT qua RLS.

CREATE OR REPLACE FUNCTION public.gen_affiliate_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bang_chu CONSTANT text := '23456789abcdefghjkmnpqrstuvwxyz';
  ma text;
  i int;
  lan_thu int := 0;
BEGIN
  LOOP
    ma := 'vipro';
    FOR i IN 1..6 LOOP
      ma := ma || substr(bang_chu, 1 + floor(random() * length(bang_chu))::int, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE affiliate_code = ma);

    lan_thu := lan_thu + 1;
    -- Với gần 900 triệu tổ hợp thì không bao giờ nên tới đây. Tới được nghĩa là
    -- random() hỏng, và lúc đó thà cho mã xấu còn hơn treo vòng lặp vô hạn ngay
    -- trong luồng đăng ký.
    IF lan_thu >= 20 THEN
      ma := 'vipro' || replace(gen_random_uuid()::text, '-', '');
      EXIT;
    END IF;
  END LOOP;

  RETURN ma;
END;
$$;


-- ─── 2. Trigger: mã có mặt từ lúc hàng được tạo ───
--
-- Đặt ở tầng CSDL chứ không ở `handle_new_user()`, vì trigger bắt MỌI đường chèn
-- profile — kể cả đường chưa tồn tại hôm nay. Sửa `handle_new_user()` thì chỉ vá
-- đúng một đường, và đường thứ hai sẽ lại đẻ ra profile không mã.
--
-- Bắt cả ba trường hợp: bỏ trống cột, truyền NULL, và truyền chuỗi rỗng. DEFAULT
-- của cột chỉ bắt được trường hợp đầu.

CREATE OR REPLACE FUNCTION public.ensure_affiliate_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.affiliate_code IS NULL OR btrim(NEW.affiliate_code) = '' THEN
    NEW.affiliate_code := public.gen_affiliate_code();
  ELSE
    -- Chuẩn hoá về chữ thường: mã được gõ tay, và `WHERE affiliate_code = $1`
    -- phân biệt hoa thường. Không chuẩn hoá thì 'VIPROH7K2MQ' tra không ra gì.
    NEW.affiliate_code := lower(btrim(NEW.affiliate_code));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_ensure_affiliate_code ON public.profiles;
CREATE TRIGGER profiles_ensure_affiliate_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_affiliate_code();


-- ─── 3. Bù mã cho tài khoản đã có ───
--
-- Phải đi từng dòng, KHÔNG dùng một câu UPDATE cho cả bảng: trong cùng một câu lệnh,
-- `EXISTS` bên trong hàm sinh mã đọc ảnh chụp dữ liệu lúc câu lệnh bắt đầu, nên không
-- nhìn thấy mã vừa cấp cho dòng trước. Hai dòng trùng mã là đủ làm vỡ chỉ số UNIQUE
-- và hỏng cả lần migrate.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.profiles
    WHERE affiliate_code IS NULL OR btrim(affiliate_code) = ''
  LOOP
    UPDATE public.profiles
    SET affiliate_code = public.gen_affiliate_code()
    WHERE id = r.id;
  END LOOP;
END $$;


-- ─── 4. Khoá lại: từ đây mã rỗng là không thể ───
--
-- Trigger lo đường INSERT; NOT NULL lo đường UPDATE. Thiếu ràng buộc này thì một câu
-- UPDATE lỡ tay vẫn xoá được mã của đối tác, và mọi link họ đã phát ra ngoài chết theo.

-- `SET NOT NULL` trên cột đã NOT NULL là lệnh rỗng, nên chạy lại nhiều lần vẫn an toàn
-- và không cần bắt lỗi. Câu kiểm trước đó mới là thứ đáng giữ: nó dừng migration lại
-- với thông báo đọc được, thay vì để Postgres báo "column contains null values" trần trụi.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE affiliate_code IS NULL OR btrim(affiliate_code) = ''
  ) THEN
    RAISE EXCEPTION 'Van con profile khong co ma gioi thieu — buoc bu ma o muc 3 chua chay xong';
  END IF;
END $$;

ALTER TABLE public.profiles ALTER COLUMN affiliate_code SET NOT NULL;


-- ─── 5. Tra mã không phân biệt hoa thường ───
--
-- Khách gõ tay mã vào ô "Nhập mã giới thiệu". Bản cũ so khớp chính xác, nên gõ hoa
-- là hỏng mà không có thông báo nào giải thích được.

CREATE OR REPLACE FUNCTION public.lookup_affiliate_referrer(ref_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id FROM public.profiles
  WHERE affiliate_code = lower(btrim(ref_code))
  LIMIT 1;
$$;
