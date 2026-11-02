/**
 * Khoá tuần tự của GoTrue: một tác vụ treo không được làm chết cả ứng dụng.
 *
 * ── Lỗi thật, đo trên production ngày 29/10/2026 ──
 *
 * Console in `[Auth] getSession() timed out after 3s`, nghĩa là có một tác vụ auth
 * treo. Vì supabase-js lấy token qua khoá này cho MỌI truy vấn, một tác vụ treo là
 * mọi lệnh `supabase.from(...)` treo theo. Nút "Lưu & Tải lên…" quay sáu tiếng,
 * không lỗi, và **không một dòng nào xuống CSDL**. `try/catch` vô dụng vì promise
 * treo không ném lỗi.
 *
 * Bản khoá cũ giữ tuần tự đúng trong trường hợp bình thường — tôi đã nhầm khi nói
 * nó bỏ rơi hàng đợi. Lỗi thật nằm chỗ khác và nặng hơn: **cả bản cũ lẫn một chuỗi
 * promise thuần đều kẹt VĨNH VIỄN** khi tác vụ đang giữ khoá không kết thúc.
 *
 * Bản hiện tại chờ có giới hạn: hết 5 giây thì đi tiếp. Mất tính loại trừ trong
 * chốc lát còn hơn treo cả ứng dụng.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

const HET_GIO_MS = 5000;

/** Bản khoá hiện tại trong `client.ts`, chép nguyên để test không phải nạp client. */
function taoKhoa() {
  let chuoi: Promise<unknown> = Promise.resolve();
  return function khoa<R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> {
    const truoc = chuoi;
    const ketQua = (async () => {
      await Promise.race([
        truoc.then(() => undefined, () => undefined),
        new Promise<void>((r) => setTimeout(r, HET_GIO_MS)),
      ]);
      return fn();
    })();
    chuoi = ketQua.then(() => undefined, () => undefined);
    return ketQua;
  };
}

/** Bản CŨ, giữ lại để chứng minh test bắt được lỗi. */
function taoKhoaCu() {
  let isLocking = false;
  const lockQueue: Array<() => void> = [];
  return (_name: string, ..._args: any[]) => {
    const acquire = _args[_args.length - 1];
    return new Promise((resolve, reject) => {
      const run = async () => {
        try { resolve(await acquire()); }
        catch (e) { reject(e); }
        finally {
          isLocking = false;
          const next = lockQueue.shift();
          if (next) next();
        }
      };
      if (isLocking) lockQueue.push(run);
      else { isLocking = true; run(); }
    });
  };
}

const doi = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(() => vi.useRealTimers());

describe('Khoá tuần tự GoTrue', () => {
  it('MỘT TÁC VỤ TREO không làm chết các tác vụ sau', async () => {
    // Phép kiểm quan trọng nhất — đúng tình huống đã xảy ra trên production.
    vi.useFakeTimers();
    const khoa = taoKhoa();

    // Tác vụ treo: không bao giờ resolve.
    khoa('l', 0, () => new Promise<void>(() => {}));

    let xong = false;
    const sau = khoa('l', 0, async () => { xong = true; return 'chạy được'; });

    await vi.advanceTimersByTimeAsync(HET_GIO_MS - 100);
    expect(xong, 'chưa hết giờ thì vẫn phải xếp hàng').toBe(false);

    await vi.advanceTimersByTimeAsync(200);
    await expect(sau).resolves.toBe('chạy được');
  });

  it('bản CŨ chết hẳn ở đúng tình huống đó', async () => {
    // Nếu bản cũ cũng qua được thì phép kiểm trên vô nghĩa.
    vi.useFakeTimers();
    const khoa = taoKhoaCu();
    khoa('l', 0, () => new Promise<void>(() => {}));

    let xong = false;
    khoa('l', 0, async () => { xong = true; });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(xong, 'Bản cũ phải kẹt vĩnh viễn — nếu không thì test vô nghĩa').toBe(false);
  });

  it('chạy tuần tự khi mọi tác vụ đều bình thường', async () => {
    const khoa = taoKhoa();
    let dangChay = 0;
    let caoNhat = 0;
    await Promise.all(
      Array.from({ length: 20 }, () =>
        khoa('l', 0, async () => {
          dangChay++;
          caoNhat = Math.max(caoNhat, dangChay);
          await doi(1);
          dangChay--;
        })
      )
    );
    expect(caoNhat, 'Mỗi lúc chỉ một tác vụ').toBe(1);
  });

  it('mọi lời gọi đều kết thúc, không bỏ rơi cái nào', async () => {
    const khoa = taoKhoa();
    const n = 40;
    const ra = await Promise.all(
      Array.from({ length: n }, (_, i) => khoa('l', 0, async () => { await doi(i % 3); return i; }))
    );
    expect(ra).toEqual(Array.from({ length: n }, (_, i) => i));
  });

  it('một tác vụ lỗi KHÔNG làm kẹt những tác vụ sau', async () => {
    const khoa = taoKhoa();
    await expect(khoa('l', 0, async () => { throw new Error('token hỏng'); })).rejects.toThrow('token hỏng');
    await expect(khoa('l', 0, async () => 'vẫn chạy')).resolves.toBe('vẫn chạy');
  });

  it('lỗi trả đúng người gọi, không nuốt mất', async () => {
    const khoa = taoKhoa();
    const ket = await Promise.allSettled([
      khoa('l', 0, async () => 'a'),
      khoa('l', 0, async () => { throw new Error('b hỏng'); }),
      khoa('l', 0, async () => 'c'),
    ]);
    expect(ket[0]).toMatchObject({ status: 'fulfilled', value: 'a' });
    expect(ket[1].status).toBe('rejected');
    expect(ket[2]).toMatchObject({ status: 'fulfilled', value: 'c' });
  });

  it('giữ đúng thứ tự gọi', async () => {
    const khoa = taoKhoa();
    const thuTu: number[] = [];
    await Promise.all(
      [5, 1, 3, 0, 2].map((ms, i) => khoa('l', 0, async () => { await doi(ms); thuTu.push(i); }))
    );
    expect(thuTu, 'Theo thứ tự gọi, không theo thời gian chạy').toEqual([0, 1, 2, 3, 4]);
  });
});
