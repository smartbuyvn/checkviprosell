/**
 * Gác: truy vấn "dữ liệu của tôi" phải tự lọc theo user_id, không trông vào RLS.
 *
 * Vì sao cần gác theo khuôn thay vì nhớ bằng tay: ngày 29/10 lỗi này có mặt ở SÁU
 * truy vấn thuộc BỐN file khác nhau, và không file nào trông có vẻ sai khi đọc riêng
 * lẻ. Nguyên nhân chung nằm ở cơ sở dữ liệu — có chính sách cho admin đọc cả bảng:
 *
 *   CREATE POLICY "Admins read all projects" ON public.projects
 *     FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
 *
 * Với tài khoản thường RLS che đúng, nên lỗi vô hình suốt quá trình phát triển. Với
 * tài khoản admin thì dashboard hiện video của khách, và số dư credit hiển thị là
 * của một khách bất kỳ. Thêm một chính sách admin cho bảng mới là đủ tái hiện.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/** Hàm trong các service dưới đây trả về dữ liệu của riêng người đang đăng nhập. */
const PHAI_LOC_THEO_USER: Array<{ file: string; ham: string }> = [
  { file: 'src/services/project.service.ts', ham: 'listByUser' },
  { file: 'src/services/project.service.ts', ham: 'listWithVideos' },
  { file: 'src/services/credit.service.ts', ham: 'getBalance' },
  { file: 'src/services/credit.service.ts', ham: 'getLedger' },
  { file: 'src/services/usage.service.ts', ham: 'getByUser' },
  { file: 'src/services/render.service.ts', ham: 'getCompletedCount' },
];

/** Điều kiện lọc thẳng (`user_id`) hoặc bắc cầu qua bảng cha (`projects.user_id`). */
const CO_LOC_USER = /\.eq\(\s*'[A-Za-z_]*\.?user_id'/;

/**
 * Cắt lấy thân hàm `async ten(` bằng cách đếm ngoặc nhọn.
 *
 * Không thể lấy ngay dấu `{` đầu tiên sau tên hàm: khai báo kiểu trả về
 * `Promise<{ count: number }>` cũng có `{`, và lấy nhầm nó thì phép kiểm đọc trúng
 * kiểu thay vì thân hàm rồi báo thiếu điều kiện một cách sai. Nên bỏ qua danh sách
 * tham số và phần kiểu trước, rồi mới lấy `{` ở ngoài mọi ngoặc nhọn `<>`.
 */
function thanHam(nguon: string, ten: string): string {
  const batDau = nguon.indexOf(`async ${ten}(`);
  if (batDau < 0) return '';

  // Qua hết danh sách tham số.
  let i = nguon.indexOf('(', batDau);
  let sauTron = 0;
  for (; i < nguon.length; i++) {
    if (nguon[i] === '(') sauTron++;
    else if (nguon[i] === ')' && --sauTron === 0) break;
  }

  // Dấu `{` của thân hàm là dấu đầu tiên nằm ngoài mọi `<...>` của phần kiểu.
  let sauNhon = 0;
  let moNgoac = -1;
  for (i++; i < nguon.length; i++) {
    const c = nguon[i];
    if (c === '<') sauNhon++;
    else if (c === '>') sauNhon--;
    else if (c === '{' && sauNhon === 0) { moNgoac = i; break; }
  }
  if (moNgoac < 0) return '';

  let sau = 0;
  for (let i = moNgoac; i < nguon.length; i++) {
    if (nguon[i] === '{') sau++;
    else if (nguon[i] === '}' && --sau === 0) return nguon.slice(moNgoac, i + 1);
  }
  return nguon.slice(moNgoac);
}

describe('Truy vấn dữ liệu cá nhân không được dựa vào RLS', () => {
  for (const { file, ham } of PHAI_LOC_THEO_USER) {
    it(`${file} → ${ham}() lọc theo user_id`, () => {
      const than = thanHam(readFileSync(resolve(process.cwd(), file), 'utf8'), ham);
      expect(than, `không tìm thấy hàm ${ham} trong ${file}`).not.toBe('');

      expect(than, `${ham}() thiếu điều kiện user_id — admin sẽ thấy dữ liệu khách`)
        .toMatch(CO_LOC_USER);

      expect(than, `${ham}() phải lấy id người dùng qua currentUserId()`)
        .toContain('currentUserId()');
    });
  }

  it('phát hiện được khi điều kiện user_id bị bỏ', () => {
    // Kiểm tra chính cái gác: bỏ điều kiện ra thì phép so khớp phải thất bại, nếu
    // không thì sáu phép kiểm trên chỉ là trang trí.
    const thieu = `{ const uid = await currentUserId();
      await supabase.from('credit_ledger').select('*').order('created_at'); }`;
    const du = `{ const uid = await currentUserId();
      await supabase.from('credit_ledger').select('*').eq('user_id', uid as never); }`;
    expect(thieu).not.toMatch(CO_LOC_USER);
    expect(du).toMatch(CO_LOC_USER);
  });
});
