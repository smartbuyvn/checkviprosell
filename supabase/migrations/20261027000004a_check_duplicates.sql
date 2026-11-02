-- ============================================================
-- KIỂM TRA TRƯỚC — chỉ đọc, không đổi gì
-- Chạy file này trước 20261027000004_unique_project_id.sql
--
-- Nếu mọi dòng đều có so_du_an_bi_trung = 0 thì chạy thẳng migration kia được.
-- Nếu có số khác 0 thì dừng lại và báo, đừng tự tạo chỉ mục: chỉ mục duy nhất
-- áp lên dữ liệu đã trùng sẽ báo lỗi và không tạo được gì.
-- ============================================================

SELECT 'product_intelligence' AS bang,
       count(*) AS so_du_an_bi_trung,
       coalesce(sum(so_dong) - count(*), 0) AS so_dong_thua
FROM (
  SELECT project_id, count(*) AS so_dong
  FROM public.product_intelligence
  GROUP BY project_id HAVING count(*) > 1
) t

UNION ALL
SELECT 'scripts', count(*), coalesce(sum(so_dong) - count(*), 0)
FROM (
  SELECT project_id, count(*) AS so_dong
  FROM public.scripts
  GROUP BY project_id HAVING count(*) > 1
) t

UNION ALL
SELECT 'visual_packs', count(*), coalesce(sum(so_dong) - count(*), 0)
FROM (
  SELECT project_id, count(*) AS so_dong
  FROM public.visual_packs
  GROUP BY project_id HAVING count(*) > 1
) t

UNION ALL
SELECT 'caption_exports', count(*), coalesce(sum(so_dong) - count(*), 0)
FROM (
  SELECT project_id, count(*) AS so_dong
  FROM public.caption_exports
  GROUP BY project_id HAVING count(*) > 1
) t;
