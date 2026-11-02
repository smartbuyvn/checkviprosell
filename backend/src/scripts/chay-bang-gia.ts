/**
 * Chạy migration 20261028000003_bang_gia_moi.sql bằng service role.
 *
 * File .sql đó chỉ có UPDATE/INSERT trên bảng `plans`, không có DDL, nên chạy qua
 * supabase-js cho kết quả y hệt chạy trong SQL Editor. Chạy lại nhiều lần đều an toàn.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function inBang(nhan: string) {
  const { data } = await sb.from('plans').select('code,name,credits,price,is_active').order('price');
  console.log(`\n=== ${nhan} ===`);
  for (const p of data ?? []) {
    console.log(
      `  ${String(p.code).padEnd(10)} ${String(p.name).padEnd(10)} ` +
      `${String(p.credits).padStart(4)} credit  ${String(p.price).padStart(7)}d  ` +
      (p.is_active ? 'dang ban' : 'TAT')
    );
  }
}

(async () => {
  await inBang('TRUOC');

  const F = (x: string[]) => JSON.stringify(x);
  const buoc: Array<[string, () => Promise<{ error: unknown }>]> = [
    ['free -> 3 credit', async () => sb.from('plans').update({
      credits: 3, is_active: true,
      features: F(['3 credits dùng thử', 'Video có watermark', 'Độ phân giải 720p', 'Render bản nháp']),
    } as never).eq('code', 'free' as never)],

    ['pro -> 249k/80', async () => sb.from('plans').update({
      name: 'Pro', credits: 80, price: 249000, is_active: true,
      features: F(['80 credits', 'Tất cả loại video', 'Xuất caption', 'Hỗ trợ ưu tiên']),
    } as never).eq('code', 'pro' as never)],

    ['business -> 499k/180', async () => sb.from('plans').update({
      name: 'Business', credits: 180, price: 499000, is_active: true,
      features: F(['180 credits', 'Tất cả loại video', 'Xuất caption', 'Hỗ trợ ưu tiên']),
    } as never).eq('code', 'business' as never)],

    // premium: TAT chu KHONG xoa — khach mua truoc day van can dong nay de doi soat.
    ['premium -> tat ban', async () => sb.from('plans').update({ is_active: false } as never).eq('code', 'premium' as never)],
  ];

  for (const [ten, chay] of buoc) {
    const { error } = await chay();
    console.log(`  ${error ? 'LOI  ' : 'OK   '} ${ten}${error ? ': ' + (error as any).message : ''}`);
  }

  // starter: them neu chua co, roi cap nhat cho chac
  const { data: co } = await sb.from('plans').select('code').eq('code', 'starter' as never).maybeSingle();
  if (!co) {
    const { error } = await sb.from('plans').insert({
      code: 'starter', name: 'Starter', credits: 30, price: 129000, currency: 'VND', is_active: true,
      features: F(['30 credits', 'Tất cả loại video', 'Xuất caption', 'Hỗ trợ qua email']),
    } as never);
    console.log(`  ${error ? 'LOI  ' : 'OK   '} them goi starter${error ? ': ' + error.message : ''}`);
  } else {
    const { error } = await sb.from('plans').update({
      name: 'Starter', credits: 30, price: 129000, is_active: true,
      features: F(['30 credits', 'Tất cả loại video', 'Xuất caption', 'Hỗ trợ qua email']),
    } as never).eq('code', 'starter' as never);
    console.log(`  ${error ? 'LOI  ' : 'OK   '} cap nhat starter${error ? ': ' + error.message : ''}`);
  }

  await inBang('SAU');
})();
