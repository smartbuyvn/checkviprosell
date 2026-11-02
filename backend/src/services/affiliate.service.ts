import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

/** Ngưỡng rút tối thiểu. Trùng với policy.minWithdrawalVnd trả cho giao diện. */
const MIN_WITHDRAWAL_VND = 125000;

/** Số ngày giữ hoa hồng trước khi cho rút, chống hoàn tiền sau khi đã trả. */
const HOLD_DAYS = 7;

export const AffiliateService = {
  /**
   * Chuyển hoa hồng đã qua thời gian giữ từ 'pending' sang 'approved'.
   *
   * Trước đây `holdUntil` được ghi vào meta lúc tạo hoa hồng nhưng KHÔNG có gì đọc nó:
   * không cron, không job. Hệ quả là mọi hoa hồng nằm mãi ở 'pending', số dư rút được
   * luôn bằng 0, và đối tác không bao giờ lấy được tiền.
   *
   * Làm ngay lúc đọc bảng điều khiển thay vì dựng cron: không cần thêm hạ tầng, chạy lại
   * nhiều lần cũng cho cùng kết quả, và đối tác thấy số dư đúng ngay khi mở trang.
   */
  async approveMaturedCommissions(referrerId: string): Promise<number> {
    const { data: pendings } = await supabase
      .from('affiliate_events')
      .select('id, created_at, meta')
      .eq('referrer_id', referrerId)
      .eq('status', 'pending');

    if (!pendings || pendings.length === 0) return 0;

    const now = Date.now();
    const matured = pendings
      .filter((e: any) => {
        // Ưu tiên holdUntil trong meta; sự kiện cũ không có thì suy từ created_at.
        const raw = e?.meta?.holdUntil;
        const until = raw
          ? Date.parse(raw)
          : Date.parse(e.created_at) + HOLD_DAYS * 24 * 60 * 60 * 1000;
        return Number.isFinite(until) && now >= until;
      })
      .map((e: any) => e.id);

    if (matured.length === 0) return 0;

    const { error } = await supabase
      .from('affiliate_events')
      .update({ status: 'approved' })
      .in('id', matured)
      .eq('status', 'pending'); // chặn ghi đè nếu một tiến trình khác vừa đổi

    if (error) {
      console.warn(`[Affiliate] Không duyệt được hoa hồng của ${referrerId}: ${error.message}`);
      return 0;
    }
    return matured.length;
  },

  /**
   * Tạo yêu cầu rút tiền.
   * Kiểm tra ở backend chứ không tin số giao diện gửi lên: số dư, ngưỡng tối thiểu,
   * và không cho mở yêu cầu thứ hai khi còn một yêu cầu đang xử lý.
   */
  async requestWithdrawal(
    userId: string,
    input: { amountVnd: number; bank: string; accountNo: string; accountName: string }
  ) {
    const amount = Math.floor(Number(input.amountVnd));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Số tiền không hợp lệ');
    }
    for (const [field, label] of [
      ['bank', 'tên ngân hàng'],
      ['accountNo', 'số tài khoản'],
      ['accountName', 'tên chủ tài khoản'],
    ] as const) {
      if (!String(input[field] ?? '').trim()) throw new Error(`Thiếu ${label}`);
    }

    // Duyệt phần đã đến hạn trước, để đối tác rút được ngay thay vì phải đợi lần mở sau.
    await this.approveMaturedCommissions(userId);

    const { data: approvedEvents } = await supabase
      .from('affiliate_events')
      .select('commission_amount')
      .eq('referrer_id', userId)
      .eq('status', 'approved');

    const available = (approvedEvents || []).reduce(
      (acc: number, e: any) => acc + Number(e.commission_amount || 0),
      0
    );

    if (available < MIN_WITHDRAWAL_VND) {
      throw new Error(
        `Số dư rút được là ${available.toLocaleString('vi-VN')}đ, ` +
        `chưa đạt mức tối thiểu ${MIN_WITHDRAWAL_VND.toLocaleString('vi-VN')}đ`
      );
    }
    if (amount > available) {
      throw new Error(`Chỉ rút được tối đa ${available.toLocaleString('vi-VN')}đ`);
    }
    if (amount < MIN_WITHDRAWAL_VND) {
      throw new Error(`Mỗi lần rút tối thiểu ${MIN_WITHDRAWAL_VND.toLocaleString('vi-VN')}đ`);
    }

    const { data, error } = await supabase
      .from('affiliate_withdrawals')
      .insert({
        referrer_id: userId,
        amount_vnd: amount,
        status: 'requested',
        payout_account: {
          bank: String(input.bank).trim(),
          account_no: String(input.accountNo).trim(),
          account_name: String(input.accountName).trim(),
        },
        meta: { availableAtRequestVnd: available },
      })
      .select('id, amount_vnd, status, requested_at')
      .single();

    if (error) {
      // Chỉ số uniq_affiliate_withdrawal_open chặn yêu cầu thứ hai khi còn một cái đang mở.
      if (error.code === '23505') {
        throw new Error('Bạn đang có một yêu cầu rút chờ xử lý. Đợi xử lý xong rồi gửi tiếp.');
      }
      if (error.code === 'PGRST205') {
        throw new Error('Chức năng rút tiền chưa sẵn sàng: thiếu bảng affiliate_withdrawals.');
      }
      throw new Error(`Không tạo được yêu cầu rút: ${error.message}`);
    }

    return { success: true, withdrawal: data };
  },

  /** Lịch sử yêu cầu rút của chính đối tác. */
  async getWithdrawals(userId: string) {
    const { data, error } = await supabase
      .from('affiliate_withdrawals')
      .select('id, amount_vnd, status, note, requested_at, processed_at')
      .eq('referrer_id', userId)
      .order('requested_at', { ascending: false })
      .limit(50);

    // Chưa chạy migration thì trả danh sách rỗng thay vì làm vỡ cả trang.
    if (error) {
      if (error.code === 'PGRST205') return [];
      throw new Error(error.message);
    }
    return data || [];
  },

  async getDashboard(userId: string) {
    // Duyet phan da qua thoi gian giu TRUOC khi doc, neu khong so du rut duoc se
    // hien 0 cho den lan mo trang ke tiep.
    await this.approveMaturedCommissions(userId);

    const { data: profile } = await supabase.from('profiles').select('affiliate_code').eq('id', userId).single();
    
    // Select all events generated by this referrer
    const { data: events } = await supabase.from('affiliate_events')
      .select('*')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false });

    const code = profile?.affiliate_code || '';

    // Ma rong nghia la link gioi thieu cua doi tac nay chet: '.../signup?ref=' khong
    // quy duoc giao dich ve ai. Trigger profiles_ensure_affiliate_code dam bao chuyen
    // nay khong con xay ra, nhung neu van xay ra thi phai keu len — chinh su IM LANG
    // o day da de ca chuong trinh affiliate khong chay suot tu ngay dau ma khong ai biet.
    if (!code) {
      console.error(`[Affiliate] profile ${userId} KHONG CO affiliate_code — link gioi thieu se chet. Kiem tra migration 20261028000004.`);
    }

    // Count all users referred by this affiliate code
    let totalReferrals = 0;
    if (code) {
      const { count } = await supabase.from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('referred_by', code);
      totalReferrals = count || 0;
    }

    let pendingVnd = 0, approvedVnd = 0, paidVnd = 0, rejectedVnd = 0;
    const referredSet = new Set<string>();

    const safeEvents = events || [];
    
    const mappedEvents = safeEvents.map(e => {
      referredSet.add(e.referred_id);
      
      const amount = Number(e.commission_amount || 0);
      if (e.status === 'pending') pendingVnd += amount;
      if (e.status === 'approved') approvedVnd += amount;
      if (e.status === 'paid') paidVnd += amount;
      if (e.status === 'rejected') rejectedVnd += amount;

      const meta = (e.meta || {}) as Record<string, any>;

      return {
        id: e.id,
        eventType: meta.eventType || 'first_paid_conversion',
        referredUserId: e.referred_id,
        commissionVnd: amount,
        status: e.status,
        createdAt: e.created_at,
        note: meta.reason || 'Hoa hồng từ giao dịch người dùng giới thiệu'
      };
    });

    const withdrawals = await this.getWithdrawals(userId);

    // Tien dang nam trong cac yeu cau chua tra xong khong duoc tinh la rut duoc nua,
    // neu khong doi tac se rut duoc hai lan cung mot so tien.
    const lockedVnd = withdrawals
      .filter((w: any) => w.status === 'requested' || w.status === 'approved')
      .reduce((acc: number, w: any) => acc + Number(w.amount_vnd || 0), 0);

    const availableVnd = Math.max(0, approvedVnd - lockedVnd);

    const appBaseUrl = process.env.VITE_APP_BASE_URL || 'http://localhost:8080';
    
    const totalAccVnd = pendingVnd + approvedVnd + paidVnd;
    const tier = totalAccVnd >= 2500000 ? 'gold' : 'silver';
    // Ty le ap tren gia niem yet cua goi (VND).
    const commissionRate = tier === 'gold' ? 0.15 : 0.10;

    return {
      affiliateCode: code,
      tier: tier,
      totalAccumulatedVnd: totalAccVnd,
      referralLink: `${appBaseUrl}/signup?ref=${code}`,
      policy: {
        commissionRate: commissionRate,
        firstPaidOnly: false,
        holdDays: 7,
        minWithdrawalVnd: 125000,
        tierThresholdVnd: 2500000
      },
      summary: {
        totalReferrals: Math.max(totalReferrals, referredSet.size),
        firstPaidConversions: safeEvents.filter(x => x.status !== 'rejected').length,
        pendingCommissionVnd: pendingVnd,
        approvedCommissionVnd: approvedVnd,
        paidCommissionVnd: paidVnd,
        rejectedCommissionVnd: rejectedVnd,
        /** So tien doi tac co the yeu cau rut ngay bay gio. */
        availableVnd,
        /** Dang nam trong yeu cau chua tra xong. */
        lockedVnd
      },
      withdrawals,
      events: mappedEvents
    };
  },

  async refer(userId: string, codeRaw: string) {
    // Chuan hoa TRUOC moi viec khac.
    //
    // Ma duoc go tay vao o "Nhap ma gioi thieu", va `.eq('affiliate_code', ...)` phan
    // biet hoa thuong. Khong chuan hoa thi khach go 'VIPROH7K2MQ' nhan duoc "Ma gioi
    // thieu khong ton tai" — thong bao dung ve ky thuat va vo nghia voi ho. Chuan hoa
    // o day thi ca lan tra cuu lan gia tri luu vao `referred_by` deu ve mot dang,
    // nen webhook quy hoa hong sau nay cung khop.
    const code = String(codeRaw ?? '').trim().toLowerCase();
    if (!code) throw new Error('Mã giới thiệu không hợp lệ');

    // 1. Validate the code exists and belongs to someone else
    const { data: referrerProfile, error: referrerError } = await supabase
      .from('profiles')
      .select('id')
      .eq('affiliate_code', code)
      .single();

    if (referrerError || !referrerProfile) {
      throw new Error('Mã giới thiệu không tồn tại');
    }

    if (referrerProfile.id === userId) {
      throw new Error('Bạn không thể tự giới thiệu chính mình');
    }

    // 2. Check if current user already has a referrer
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('referred_by')
      .eq('id', userId)
      .single();

    if (userError || !userProfile) {
      throw new Error('Không tìm thấy thông tin người dùng');
    }

    if (userProfile.referred_by) {
      // If the code is the same, just return success (idempotent)
      if (userProfile.referred_by === code) {
        return { success: true };
      }
      throw new Error('Bạn đã nhập mã giới thiệu trước đó rồi');
    }

    // 3. Update the user's profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ referred_by: code })
      .eq('id', userId);

    if (updateError) {
      throw new Error('Lỗi cập nhật mã giới thiệu');
    }

    return { success: true };
  }
};
