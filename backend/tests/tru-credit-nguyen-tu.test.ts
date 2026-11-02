/**
 * Canh quyết định "có lùi về đường trừ credit cũ hay không".
 *
 * ── Vì sao đây là chỗ đáng canh nhất ──
 *
 * `deductToLedger` gọi `tru_credit_render()` trong Postgres. Khi lệnh gọi đó lỗi, có
 * đúng MỘT trường hợp được lùi về đường cũ: hàm chưa tồn tại trong cơ sở dữ liệu
 * (migration chưa chạy). Mọi lỗi khác thì đường cũ cũng không chữa được.
 *
 * Nhận diện sai theo hai hướng đều tệ, và tệ khác nhau:
 *
 *   - Nhận quá RỘNG (coi mọi lỗi là thiếu hàm): một lỗi mạng hay hết quyền sẽ âm thầm
 *     kéo đường TIỀN về lối có hai lỗ đã biết, mà log chỉ nói "thiếu hàm" — người đọc
 *     log đi sửa sai chỗ.
 *   - Nhận quá HẸP (không bắt được): migration chưa chạy thì mọi render hoàn thành đều
 *     không trừ được tiền, route callback đánh dấu chúng 'failed' với "Không đủ xu", và
 *     khách mất video đáng được nhận.
 *
 * Nên hàm này có test cho từng dạng lỗi thật mà PostgREST trả về.
 *
 * Hàm nằm ở `lib/loi-rpc.ts` chứ không trong `credit.service.ts` vì service tạo client
 * Supabase ngay lúc nạp module — import nó trong test sẽ vỡ với "supabaseKey is required".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thieuHamRpc } from '../src/lib/loi-rpc';

/** Bọc lại cho gọn: mọi phép kiểm dưới đây đều hỏi về đúng hàm trừ credit. */
const thieuHamTruCredit = (e: any) => thieuHamRpc(e, 'tru_credit_render');

test('bat duoc ma PGRST202 cua PostgREST', () => {
  assert.equal(
    thieuHamTruCredit({
      code: 'PGRST202',
      message: 'Could not find the function public.tru_credit_render(p_ly_do, p_project, p_render, p_so_credit, p_user) in the schema cache',
    }),
    true,
  );
});

test('bat duoc theo thong diep khi ma doi theo phien ban', () => {
  // Ma co the doi; thong diep thi on dinh hon. Nhan ca hai dau hieu.
  assert.equal(
    thieuHamTruCredit({
      message: 'Could not find the function public.tru_credit_render in the schema cache',
    }),
    true,
  );
});

test('khong phan biet chu hoa chu thuong trong thong diep', () => {
  assert.equal(
    thieuHamTruCredit({ message: 'COULD NOT FIND THE FUNCTION public.TRU_CREDIT_RENDER' }),
    true,
  );
});

test('ma dung nhung thieu ham KHAC thi KHONG lui', () => {
  // Day la nhanh de bo sot nhat. Mot ham khac bi thieu khong duoc keo duong tien ve
  // loi kem an toan — no la mot loi khac han va phai lo ra.
  assert.equal(
    thieuHamTruCredit({
      code: 'PGRST202',
      message: 'Could not find the function public.nhan_job_render(p_worker) in the schema cache',
    }),
    false,
  );
});

test('loi mang KHONG duoc coi la thieu ham', () => {
  for (const e of [
    { message: 'fetch failed' },
    { message: 'TypeError: network error' },
    { code: 'ETIMEDOUT', message: 'connect ETIMEDOUT' },
    { message: 'upstream connect error or disconnect/reset before headers' },
  ]) {
    assert.equal(thieuHamTruCredit(e), false, JSON.stringify(e));
  }
});

test('loi quyen KHONG duoc coi la thieu ham', () => {
  // `tru_credit_render` chi cap quyen cho service_role. Goi bang khoa anon se ra loi
  // quyen — lui ve duong cu se CHE MAT viec dang dung sai khoa.
  for (const e of [
    { code: '42501', message: 'permission denied for function tru_credit_render' },
    { code: 'PGRST301', message: 'JWT expired' },
    { message: 'permission denied for table credit_ledger' },
  ]) {
    assert.equal(thieuHamTruCredit(e), false, JSON.stringify(e));
  }
});

test('loi tham so KHONG duoc coi la thieu ham', () => {
  // PostgREST tra PGRST202 ca khi ten ham DUNG nhung bo tham so khong khop. Truong hop
  // nay THUC SU nen lui — ham co ton tai nhung khong goi duoc, va duong cu van chay.
  // Ghi lai o day de lan sau ai doc cung biet la CO CHU Y, khong phai bo sot.
  assert.equal(
    thieuHamTruCredit({
      code: 'PGRST202',
      message: 'Could not find the function public.tru_credit_render(p_sai_ten) in the schema cache',
    }),
    true,
  );
});

test('loi rong hoac null thi KHONG lui', () => {
  for (const e of [null, undefined, {}]) {
    assert.equal(thieuHamTruCredit(e as any), false, JSON.stringify(e));
  }
});

test('chi co ma, khong co thong diep, thi tin vao ma', () => {
  assert.equal(thieuHamTruCredit({ code: 'PGRST202' }), true);
  assert.equal(thieuHamTruCredit({ code: 'PGRST202', message: '' }), true);
});

test('thong diep nhac ten ham nhung khong phai loi thieu ham thi KHONG lui', () => {
  assert.equal(
    thieuHamTruCredit({ message: 'tru_credit_render: deadlock detected' }),
    false,
  );
  assert.equal(
    thieuHamTruCredit({ code: '40P01', message: 'deadlock detected in tru_credit_render' }),
    false,
  );
});
