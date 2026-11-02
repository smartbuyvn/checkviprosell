-- Viprosell — trừ credit nguyên tử và một-lần cho mỗi render
--
-- ── Vì sao cần ──
--
-- `CreditService.deductToLedger` hiện làm ba bước rời nhau:
--
--   1. Đọc số dư  = SUM(delta) trên credit_ledger
--   2. So với số cần trừ, thoát nếu không đủ
--   3. Ghi một dòng credit_ledger với balance_after tính trong mã JS
--
-- Giữa bước 1 và bước 3 không có khoá nào. Hai lần trừ xảy ra đồng thời sẽ cùng đọc
-- MỘT số dư, cùng thấy là đủ, rồi cùng ghi — khách bị trừ ít hơn phải trừ, và
-- `balance_after` của cả hai dòng đều sai. Số dư là SUM(delta) nên nó vẫn tự đúng,
-- nhưng cái CHỐT "không đủ thì không cho dựng" thì đã bị vượt.
--
-- Hiện chưa nổ vì mỗi lúc chỉ có một worker. Nó sẽ nổ khi bật `HANG_DOI_LEASE=1`
-- trên nhiều máy — đúng việc đang chuẩn bị làm.
--
-- ── Thêm một lỗ thứ hai: trừ hai lần ──
--
-- Docstring của hàm đó viết "Idempotency enforced by caller (render callback checks
-- status before calling)". Chốt ấy cũng là đọc-rồi-ghi: callback đọc `render.status`,
-- thấy chưa phải trạng thái cuối, rồi mới trừ. Hai callback cho cùng một render (giao
-- hàng ít-nhất-một-lần là chuyện bình thường) sẽ cùng đọc thấy chưa trừ.
--
-- Và `credit_ledger` KHÔNG có cột nào giữ renderId, nên không có ràng buộc nào ở mức
-- cơ sở dữ liệu chặn được việc trừ hai lần. renderId chỉ nằm trong
-- `usage_logs.meta.render_id`, tức một bản ghi phụ, không phải một ràng buộc.
--
-- ── Cách giải ──
--
-- Một hàm Postgres làm cả ba bước trong MỘT giao dịch, có khoá theo người dùng. Cộng
-- thêm một chỉ mục duy nhất trên `render_id` để "một render chỉ bị trừ một lần" thành
-- bất biến của cơ sở dữ liệu chứ không phải một quy ước trong mã.

-- ───────────────────────── 1. Cột render_id ─────────────────────────

ALTER TABLE credit_ledger
  ADD COLUMN IF NOT EXISTS render_id uuid;

COMMENT ON COLUMN credit_ledger.render_id IS
  'Render sinh ra but toan nay. Co chi muc duy nhat tren cot nay (chi voi delta < 0) nen mot render chi bi tru MOT lan. Cac dong cu de NULL — chi muc la partial nen NULL khong xung dot.';

-- Khong backfill tu usage_logs.
--
-- Ghep duoc, nhung chi ghep gan dung: usage_logs khong co khoa ngoai tro ve
-- credit_ledger, nen phai doi chieu theo (user_id, project_id) va thoi diem gan nhau.
-- Doi chieu gan dung tren BAN GHI TIEN la thu khong nen lam. 10 dong cu de NULL, va
-- chi muc partial ben duoi khong vuong gi.

-- ───────────────────────── 2. Một render chỉ bị trừ một lần ─────────────────────────
--
-- `delta < 0` trong dieu kien la co chu y: no cho phep HOAN tien cho cung mot render
-- bang mot dong delta duong. Chi muc chi tren cot render_id khong thoi se chan ca viec
-- hoan tien, tuc bien mot chot an toan thanh mot cai cong chan.

CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_render_tru_uniq
  ON credit_ledger (render_id)
  WHERE render_id IS NOT NULL AND delta < 0;

-- ───────────────────────── 3. Hàm trừ credit ─────────────────────────

CREATE OR REPLACE FUNCTION tru_credit_render(
  p_user      uuid,
  p_project   uuid,
  p_render    uuid,
  p_so_credit integer,
  p_ly_do     text
)
RETURNS TABLE (dat boolean, ma text, so_du_sau integer)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_so_du integer;
  v_sau   integer;
BEGIN
  IF p_user IS NULL OR p_render IS NULL THEN
    RETURN QUERY SELECT false, 'THIEU_THAM_SO'::text, NULL::integer;
    RETURN;
  END IF;

  -- Tru 0 hoac so am la loi cua noi goi, khong phai mot giao dich hop le.
  IF p_so_credit IS NULL OR p_so_credit <= 0 THEN
    RETURN QUERY SELECT false, 'SO_CREDIT_KHONG_HOP_LE'::text, NULL::integer;
    RETURN;
  END IF;

  -- Khoa theo NGUOI DUNG, khong khoa ca bang: hai khach khac nhau tru cung luc thi
  -- khong cho nhau. Khoa kieu xact tu nha khi giao dich ket thuc, ke ca khi loi.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  -- ── Chot mot-lan, kiem BEN TRONG khoa ──
  -- Chi muc duy nhat o phan 2 la chot cuoi, nhung kiem truoc o day thi lan goi thu hai
  -- tra ve "da tru roi" mot cach tu te, thay vi nem loi vi pham rang buoc.
  SELECT balance_after INTO v_sau
    FROM credit_ledger
   WHERE render_id = p_render AND delta < 0
   LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT true, 'DA_TRU_TRUOC_DO'::text, v_sau;
    RETURN;
  END IF;

  -- So du la SUM(delta) — so cai la nguon su that, khong phai cot balance_after.
  SELECT COALESCE(SUM(delta), 0) INTO v_so_du
    FROM credit_ledger
   WHERE user_id = p_user;

  IF v_so_du < p_so_credit THEN
    RETURN QUERY SELECT false, 'KHONG_DU_CREDIT'::text, v_so_du;
    RETURN;
  END IF;

  v_sau := v_so_du - p_so_credit;

  INSERT INTO credit_ledger (user_id, project_id, render_id, delta, reason, balance_after)
  VALUES (p_user, p_project, p_render, -p_so_credit, p_ly_do, v_sau);

  -- Nhat ky dung chung giao dich: truoc day hai lenh ghi nay roi nhau, nen mot loi o
  -- lenh thu hai de lai mot but toan khong co nhat ky doi chieu.
  INSERT INTO usage_logs (user_id, project_id, step_name, credits_used, meta)
  VALUES (
    p_user, p_project, 'render_credit_deduction', p_so_credit,
    jsonb_build_object('render_id', p_render, 'reason', p_ly_do)
  );

  RETURN QUERY SELECT true, 'DA_TRU'::text, v_sau;
END;
$$;

COMMENT ON FUNCTION tru_credit_render(uuid, uuid, uuid, integer, text) IS
  'Tru credit cho mot render: doc so du, kiem du, ghi so cai va nhat ky — TAT CA trong mot giao dich, co khoa theo nguoi dung. Goi lai cho cung render tra ve DA_TRU_TRUOC_DO chu khong tru lan hai.';

-- ───────────────────────── 4. Chỉ service_role được gọi ─────────────────────────

REVOKE ALL ON FUNCTION tru_credit_render(uuid, uuid, uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION tru_credit_render(uuid, uuid, uuid, integer, text) TO service_role;
