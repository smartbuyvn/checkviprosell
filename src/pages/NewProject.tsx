/**
 * Viprosell — New Project Wizard
 * 4-step guided project creation with real validation and upload.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, Link2, Upload, Image, ArrowRight, ArrowLeft,
  Sparkles, CheckCircle2, X, AlertCircle, FileVideo, Loader2,
  Box, Maximize, Settings2, Type, Save, Cloud, PlayCircle, Monitor, Lock, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { PACKAGES, PACKAGE_LIST } from '@/constants/packages';
import { ROUTES, buildRoute } from '@/constants/routes';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';
import { ProjectService } from '@/services/project.service';
import { RenderService, type RenderJob, type KetQuaPhuongAn, type DauUngVien } from '@/services/render.service';
import { AssetService, validateFiles, getFileCountMessage, assetUrls, type UploadProgress } from '@/services/asset.service';
import { isAbortOrLockError } from '@/lib/errorUtils';
import {
  creditsFor, giaiThichCredit, specFromChoices,
  MOC_THOI_LUONG, mocThoiLuongChoPhep, viSaoKhoaMoc,
} from '@/lib/creditCost';
import { CreditService } from '@/services/credit.service';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { PackageType, ProductCategory, RenderMode } from '@/types';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/shared/LoadingState';

const CATEGORIES: { id: ProductCategory; label: string; emoji: string; desc: string }[] = [
  { id: 'beauty', label: 'Mỹ phẩm & Skincare', emoji: '💄', desc: 'Son, kem, serum, mask...' },
  { id: 'fashion', label: 'Thời trang', emoji: '👗', desc: 'Áo, quần, phụ kiện...' },
  { id: 'home', label: 'Đồ gia dụng', emoji: '🏠', desc: 'Nhà bếp, đồ dùng, trang trí...' },
  { id: 'other', label: 'Khác', emoji: '📦', desc: 'Điện tử, ẩm thực, sức khỏe...' },
];

const EXPORT_MODES = [
  { id: 'auto', name: 'Auto', desc: 'Hệ thống tự quyết định tối ưu nhất' },
  { id: 'simple_crop', name: 'Simple Crop (Quick Ads)', desc: 'Scale & Crop trung tâm màn hình nhanh gọn' },
  { id: 'smart_pan', name: 'Smart Pan (Review)', desc: 'AI giữ focus chủ thể khi di chuyển' },
  { id: 'relayout', name: 'Relayout (Conversion)', desc: 'Tái cấu trúc UI theo aspect (hiệu quả cao, tốn thời gian)' }
];

/**
 * Hai cửa vào ngang nhau, không phải một cửa chính và một nút phụ.
 *
 * Bản cũ là 'url' | 'upload', tức cho phép chọn **chỉ link**. Nhưng không chỗ nào
 * trong hệ thống tải ảnh từ link về, và spec V3 §2.3 CẤM làm việc đó. Nên chế độ
 * "chỉ link" dẫn thẳng tới dự án không có liệu nào: người bán dán link, bấm tiếp, và
 * tưởng đã xong — rồi render chết ở guard NO_PRODUCT_IMAGES.
 *
 * Giờ link là một ô phụ, không bắt buộc, nằm trong cả hai chế độ.
 */
type SourceMode = 'images' | 'video';

/**
 * Bốn kiểu dựng cho luồng clip.
 *
 * Giữ đồng bộ với `THEMES` trong backend/src/lib/video-edit.ts — bên đó là nguồn sự
 * thật về nhạc/màu/chống rung; bên này chỉ là nhãn cho người dùng đọc.
 *
 * `tu_nhien` đứng đầu và là mặc định: đó là lời hứa của cả luồng này.
 */
const THEME_CARDS = [
  { key: 'tu_nhien', label: 'Tự nhiên', hint: 'Ít cắt, không nhạc, không chỉnh màu' },
  { key: 'sach', label: 'Gọn gàng', hint: 'Cắt theo nhịp nói, có nhạc nền êm' },
  { key: 'cao_cap', label: 'Cao cấp', hint: 'Ít cắt, màu trầm, chữ thưa' },
  { key: 'demo_tay', label: 'Thao tác tay', hint: 'Ưu tiên đoạn tay đang dùng sản phẩm' },
] as const;

/**
/**
 * Thoi luong mac dinh khi khach chua chon.
 *
 * Tu 30/10 thoi luong LA lua chon cua khach va la thu DUY NHAT quyet dinh gia
 * (1 credit moi 15 giay). Duong di: o chon o day -> `raw_input.duration_seconds`
 * -> `scene-graph.service.ts` doc no thanh `desired_duration_sec` cho tang 1.
 *
 * Tran 45 giay vi schema tang 1 va tang 3 deu kep `duration_sec` trong 10..45.
 */
const THOI_LUONG_CHUAN = 20;

/**
 * Ten tieng Viet cho ba goc tiep can cua tang 2.
 *
 * `painfirst`, `reviewtrust`, `offerconversion` la nhan noi bo. Hien thang cho nguoi
 * ban doc thi vo nghia — ho can biet video se KE THEO KIEU GI, khong phai ten bien.
 */
const NHAN_GOC: Record<string, { ten: string; giaiThich: string }> = {
  painfirst: {
    ten: 'Nêu vấn đề trước',
    giaiThich: 'Mở bằng điều khách đang bực mình, rồi mới đưa sản phẩm ra',
  },
  reviewtrust: {
    ten: 'Như người thật review',
    giaiThich: 'Giọng bạn bè kể lại, xem thử rồi nhận xét — hợp để tạo tin tưởng',
  },
  offerconversion: {
    ten: 'Nhấn vào ưu đãi',
    giaiThich: 'Đi thẳng vào giá, size, màu và lý do nên chốt ngay',
  },
};

function nhanGoc(goc: string): string {
  return NHAN_GOC[goc]?.ten ?? goc;
}

const NewProject = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('id');
  const { settings } = useSettings();
  const { toast } = useToast();

  /**
   * Gói chọn sẵn từ trang chủ: /projects/new?package=quickads
   *
   * Người bán bấm "Bắt đầu" trên thẻ gói ở trang chủ thì họ ĐÃ chọn gói rồi. Bắt họ
   * chọn lại ở bước 1 là hỏi lại một câu vừa trả lời xong.
   *
   * Chỉ nhận mã có thật trong PACKAGES — tham số URL là thứ người dùng gõ được.
   */
  const packageParam = searchParams.get('package');
  const goiChonSan = packageParam && packageParam in PACKAGES
    ? (packageParam as PackageType)
    : null;

  const [isLoadingDraft, setIsLoadingDraft] = useState(!!draftId);
  // Có gói sẵn thì vào thẳng bước chọn nguồn, nhưng chỉ khi KHÔNG mở bản nháp —
  // bản nháp có bước riêng của nó, nhảy qua sẽ bỏ mất dữ liệu đã lưu.
  const [step, setStep] = useState(goiChonSan && !draftId ? 1 : 0);
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(goiChonSan);
  
  const [sourceMode, setSourceMode] = useState<SourceMode>('images');

  /** Theme dựng clip. Mặc định tự nhiên — đúng lời hứa "giữ nguyên cảm giác bạn tự quay". */
  const [theme, setTheme] = useState<string>('tu_nhien');

  /**
   * Khách tự khai có phát nhạc khi quay.
   *
   * Đây KHÔNG phải tiện ích. Nó là nguồn số 1 của cờ `music_bed_likely`, và lời khách
   * được ưu tiên hơn phép đo RMS ở worker. Cờ đó quyết định có được đảo thứ tự cảnh
   * hay không — đảo cảnh trên clip có nhạc làm bài hát nhảy ngược.
   */
  const [coNhacKhiQuay, setCoNhacKhiQuay] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  /**
   * Bốn trường lái kịch bản.
   *
   * Hạ tầng đã sẵn: tầng 1 vốn nhận `preferred_tone`, `target_audience`,
   * `promo_text` — nhưng wizard chưa bao giờ gửi, và `target_audience` bị viết cứng
   * thành 'General'. Nên AI phải tự đoán toàn bộ góc kể.
   *
   * `khongDuocNoi` là trường mới và là trường quan trọng nhất: nó chặn trước những
   * khẳng định người bán KHÔNG muốn mang tiếng, thay vì để cổng QA gột sau.
   */
  const [loiIchChinh, setLoiIchChinh] = useState('');
  const [doiTuong, setDoiTuong] = useState('');
  const [giongDieu, setGiongDieu] = useState('');
  const [khongDuocNoi, setKhongDuocNoi] = useState('');

  /** Hai tuỳ chọn làm sạch video ở bước Cấu hình. */
  const [khongChenChu, setKhongChenChu] = useState(false);
  const [catVienAnh, setCatVienAnh] = useState(false);

  /**
   * Dấu bản quyền tìm được trên ảnh, và những dấu khách ĐÃ TÍCH.
   *
   * Tách hai thứ này là cố ý. Bộ dò chỉ đề xuất — đo ngày 31/10 trên 10 dự án thật:
   * nó tìm đúng dấu trên 2 dự án, loại sạch chữ sản phẩm trên 6, nhưng vẫn cho dương
   * tính giả trên 2 ("ninhle.com" in trên vỏ hộp, và rác OCR). Về mặt pixel, dấu của
   * sàn và chữ in trên hộp giống hệt nhau, nên chỉ khách mới phân biệt được.
   */
  const [dauTimDuoc, setDauTimDuoc] = useState<DauUngVien[] | null>(null);
  const [dauDaTich, setDauDaTich] = useState<Set<number>>(new Set());
  const [dangTimDau, setDangTimDau] = useState(false);
  const [giuLaiNeuChonHet, setGiuLaiNeuChonHet] = useState(1);
  const [nhanTimDau, setNhanTimDau] = useState('');
  const [thoiLuong, setThoiLuong] = useState(THOI_LUONG_CHUAN);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);
  
  const [aspect, setAspect] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [exportMode, setExportMode] = useState<'auto' | 'simple_crop' | 'smart_pan' | 'relayout'>('auto');
  const [renderMode, setRenderMode] = useState<RenderMode>('draft_local');

  const [uploading, setUploading] = useState(false);
  // So du credit, de bao gia noi duoc ca "du" hay "khong du" chu khong chi gia.
  const [soDu, setSoDu] = useState<number | null>(null);
  const [hoiXacNhan, setHoiXacNhan] = useState(false);
  // Du lieu da chuan bi xong, cho khach chon phuong an roi moi dung.
  const [duAnDaLuu, setDuAnDaLuu] = useState<any>(null);
  const [rawInputSan, setRawInputSan] = useState<any>(null);
  const [ketQuaPhuongAn, setKetQuaPhuongAn] = useState<KetQuaPhuongAn | null>(null);
  const [dangDoc, setDangDoc] = useState(false);
  const [phuongAnChon, setPhuongAnChon] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Dùng cho nút "Chạy thử" gọi play() trên đúng thẻ video. */
  const videoRef = useRef<HTMLVideoElement>(null);

  // Render tracking state
  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatus, setRenderStatus] = useState<string | null>(null);
  const [renderOutputUrl, setRenderOutputUrl] = useState<string | null>(null);
  const [renderThumbUrl, setRenderThumbUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  /** Moc bat dau, de hien so giay da troi — khach thay he thong con song. */
  const [renderStartedAt, setRenderStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  /** Da bao ket qua chua, de vong hoi lai khong bao trung nhieu lan. */
  const notifiedRef = useRef(false);

  /**
   * Theo dõi tiến độ render.
   *
   * Realtime một mình KHÔNG đủ: nó chỉ báo khi có UPDATE mới. Job chạy xong trước
   * khi kênh kịp kết nối, hoặc Realtime rớt một nhịp, là màn hình đứng 0% vĩnh viễn
   * dù video đã dựng xong — đúng lỗi gặp ngày 27/10.
   *
   * Nên đọc trạng thái ngay khi vào, giữ Realtime làm đường nhanh, và hỏi lại định kỳ
   * làm đường lui cho tới khi job kết thúc.
   */
  useEffect(() => {
    if (!renderJobId) return;
    let alive = true;
    notifiedRef.current = false;

    const apply = (row: any) => {
      if (!alive || !row) return;
      setRenderStatus(row.status);
      if (row.progress !== null && row.progress !== undefined) setRenderProgress(Number(row.progress));

      if (row.status === 'completed' && row.output_url) {
        setRenderProgress(100);
        setRenderOutputUrl(row.output_url);
        if (row.thumbnail_url) setRenderThumbUrl(row.thumbnail_url);
        if (!notifiedRef.current) {
          notifiedRef.current = true;
          toast({ title: 'Video đã sẵn sàng!', description: 'Bấm nút phát để xem thử.' });
        }
      } else if (row.status === 'failed' || row.status === 'retryable_failed') {
        setRenderError(row.error_message || 'Render thất bại');
        if (!notifiedRef.current) {
          notifiedRef.current = true;
          toast({ title: 'Lỗi Render', description: row.error_message || 'Có lỗi xảy ra', variant: 'destructive' });
        }
      }
    };

    const fetchOnce = async (): Promise<string | null> => {
      const { data } = await supabase
        .from('renders')
        .select('status, progress, output_url, thumbnail_url, error_message')
        .eq('id', renderJobId)
        .maybeSingle();
      apply(data);
      return (data as any)?.status ?? null;
    };

    fetchOnce();

    const channel = supabase.channel(`render_tracker_${renderJobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'renders', filter: `id=eq.${renderJobId}` },
        (payload) => apply(payload.new)
      )
      .subscribe();

    const poll = setInterval(async () => {
      const s = await fetchOnce();
      if (s === 'completed' || s === 'failed' || s === 'retryable_failed') clearInterval(poll);
    }, 3000);

    return () => {
      alive = false;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [renderJobId]);

  /** Đồng hồ đếm giây, để khách thấy hệ thống đang chạy chứ không treo. */
  useEffect(() => {
    if (!renderStartedAt || renderStatus === 'completed' || renderStatus === 'failed') return;
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - renderStartedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [renderStartedAt, renderStatus]);

  // Load Draft
  useEffect(() => {
    if (!draftId) return;
    const loadDraft = async () => {
      const { project } = await ProjectService.getById(draftId);
      if (project) {
        setSelectedPackage(project.package_type);
        setSourceUrl(project.source_url || '');

        setManualNotes(project.manual_notes || '');
        setSelectedCategory(project.category);
        const { assets } = await AssetService.getByProject(project.id);
        if (assets && assets.length > 0) {
          setSourceMode('images');
          // In a real app we'd fetch the blobs, for MVP we just show URLs or require re-upload if incomplete
        }
        // Advance to highest step
        if (project.category) setStep(3);
        else if (project.source_url || (assets && assets.length > 0)) setStep(2);
        else setStep(1);
      } else {
        toast({ title: 'Không tìm thấy draft', variant: 'destructive' });
      }
      setIsLoadingDraft(false);
    };
    loadDraft();
  }, [draftId]);

  const steps = ['Gói Video', 'Nguồn SP', 'Danh mục', 'Cấu hình', 'Render'];

  const isStep0Valid = selectedPackage !== null;
  // Cả hai chế độ đều cần file. Link một mình không còn là nguồn hợp lệ — xem chú
  // thích ở SourceMode.
  const isStep1Valid = (() => {
    const v = validateFiles(selectedFiles);
    if (!v.valid || v.errors.length > 0) return false;
    // Chế độ "từ video tôi quay" thì phải có ít nhất một clip, không chỉ ảnh.
    return sourceMode === 'video' ? v.videos.length > 0 : true;
  })();
  const isStep2Valid = selectedCategory !== null;
  const isStep3Valid = aspect !== null && exportMode !== null && renderMode !== null;

  const canProceed = (s: number) => {
    switch (s) {
      case 0: return isStep0Valid;
      case 1: return isStep1Valid;
      case 2: return isStep2Valid;
      case 3: return isStep3Valid;
      default: return true;
    }
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, [selectedFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const addFiles = (newFiles: File[]) => {
    const combined = [...selectedFiles, ...newFiles];
    const validation = validateFiles(combined);
    if (validation.errors.length > 0) {
      toast({
        title: 'Lỗi file',
        description: validation.errors.map(e => e.file ? `${e.file}: ${e.message}` : e.message).join('\n'),
        variant: 'destructive',
      });
    }
    const validFiles = [...validation.images.slice(0, 8), ...validation.videos.slice(0, 1)];
    setSelectedFiles(validFiles);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const generateTitle = () => {
    if (sourceUrl) {
      try {
        const hostname = new URL(sourceUrl).hostname.replace('www.', '');
        return `${PACKAGES[selectedPackage!].name} — ${hostname}`;
      } catch {
        return `${PACKAGES[selectedPackage!].name} — Dự án mới`;
      }
    }
    return `${PACKAGES[selectedPackage!].name} — Upload ${new Date().toLocaleDateString('vi')}`;
  };

  const saveToDb = async (isFinal: boolean) => {
    if (!selectedPackage) return { project: null, error: 'Chưa chọn gói' };
    
    const payload = {
      title: generateTitle(),
      package_type: selectedPackage,
      category: selectedCategory || 'other',
      source_url: sourceUrl.trim() || undefined,
      manual_notes: manualNotes.trim() || undefined,
    };

    if (draftId) {
      const { error } = await ProjectService.update(draftId, payload);
      return { project: { id: draftId, ...payload }, error };
    } else {
      return ProjectService.create(payload);
    }
  };

  const handleSaveExit = async () => {
    // Guard: prevent double-click race condition
    if (creating) return;
    setCreating(true);
    try {
      const { error } = await saveToDb(false);
      if (error) {
        toast({ title: 'Lỗi', description: error, variant: 'destructive' });
      } else {
        toast({ title: 'Đã lưu nháp an toàn' });
        navigate(ROUTES.DASHBOARD);
      }
    } catch (err: any) {
      // Suppress Lock broken / steal errors — they're caused by Supabase auth
      // race conditions and the save likely still succeeded
      if (isAbortOrLockError(err)) {
        console.warn('[NewProject] Lock error during save — suppressed:', err.message);
        toast({ title: 'Đã lưu nháp an toàn' });
        navigate(ROUTES.DASHBOARD);
        return;
      }
      toast({ title: 'Lỗi', description: err.message ?? 'Không thể lưu nháp', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  /**
   * Mo hop xac nhan truoc khi tieu credit.
   *
   * Khong tru tien ma khong hoi: day la khieu nai de xay ra nhat, va cung la
   * khieu nai kho cai nhat — khach khong co cach nao biet truoc so credit neu
   * khong ai noi cho ho.
   */
  const handleCreate = () => {
    if (!selectedPackage || !selectedCategory || !aspect || !exportMode) return;
    if (creating || uploading) return;
    chuanBiVaHoi();
  };

  /**
   * Luu du an, tai anh, roi HOI AI xem no hieu gi va co nhung cach ke chuyen nao.
   *
   * Phai tai anh truoc khi hoi: tang 1 can NHIN duoc san pham. Bo qua buoc do thi
   * no chi doc duoc ten tep, va hook ra se la cau chung chung dan len mat hang nao
   * cung vua — do la loi da do duoc ngay 29/10.
   *
   * Buoc nay KHONG tru credit: chua dung video nao.
   */
  const chuanBiVaHoi = async () => {
    if (creating) return;
    setCreating(true);

    try {
      const { project, error: createError } = await saveToDb(true);

      if (createError || !project) {
        toast({ title: 'Lỗi tạo dự án', description: createError ?? 'Không thể tạo bản nháp dự án', variant: 'destructive' });
        setCreating(false);
        return;
      }

      if (selectedFiles.length > 0) {
        setUploading(true);
        const { results } = await AssetService.uploadMultiple(
          project.id,
          selectedFiles,
          (progress) => setUploadProgress(progress),
        );

        const failures = results.filter(r => !r.success);
        if (failures.length > 0) {
           toast({
             title: `${failures.length} file upload thất bại`,
             description: failures.map(f => `${f.file}: ${f.error}`).join('\n'),
             variant: 'destructive',
           });
           setUploading(false);
           return; 
        }
        setUploading(false);
      }

      toast({ title: 'Bắt đầu tạo Video...', description: 'Đang tải dữ liệu và khởi tạo luồng AI Director.' });
      
      // We need to fetch the file URLs if uploaded, so we can pass them to the backend
      let imageUrls: string[] = [];
      if (project.id) {
        const { assets } = await AssetService.getByProject(project.id);
        if (assets && assets.length > 0) {
          // Cột thật trong bảng `project_assets` là `file_url`, KHÔNG phải `url`.
          //
          // `getByProject` dùng `select('*')` nên trả về hàng thô. Đọc `a.url` cho ra
          // `undefined` ở mọi hàng — trước đây mảng `[undefined, …]` đi thẳng xuống
          // worker và nổ ở `u.split('/')`; sau khi thêm bộ lọc null thì nó thành
          // mảng rỗng và chặn cứng với thông báo "Chưa có ảnh nào tải lên được",
          // trong khi ảnh vẫn nằm đủ trong cơ sở dữ liệu.
          //
          // Vẫn chấp nhận `url` làm phương án dự phòng: nếu sau này service đổi sang
          // trả về hàng đã ánh xạ thì chỗ này không hỏng lần nữa.
          imageUrls = assetUrls(assets);
        }

        if (imageUrls.length === 0) {
          toast({
            title: 'Chưa có ảnh nào tải lên được',
            description: 'Không thể dựng video khi không có ảnh sản phẩm. Thử tải lại ảnh.',
            variant: 'destructive',
          });
          return;
        }
      }

      const rawInput = {
        product_title: project.title,
        product_summary: manualNotes.trim() || 'No notes provided',
        product_url: sourceUrl || undefined,
        image_urls: imageUrls,
        // Bốn trường lái kịch bản. Tầng 1 vốn đã nhận ba trường đầu; trước đây wizard
        // không gửi và `target_audience` bị viết cứng thành 'General'.
        target_audience: doiTuong.trim() || 'General',
        preferred_tone: giongDieu.trim() || undefined,
        promo_text: loiIchChinh.trim() || undefined,
        do_not_say: khongDuocNoi.trim() || undefined,

        // Hai tuỳ chọn làm sạch. `crop_edges` là tỉ lệ cắt mỗi mép; worker chặn trần
        // ở 15% nên con số ở đây chỉ là lựa chọn mặc định của giao diện.
        no_text_overlay: khongChenChu || undefined,
        crop_edges: catVienAnh ? 0.08 : undefined,
        // Chỉ gửi khung khách ĐÃ TÍCH. Worker cắt tránh đúng những khung này.
        watermark_boxes: dauTimDuoc
          ? dauTimDuoc.filter((_, i) => dauDaTich.has(i)).map(({ x, y, w, h }) => ({ x, y, w, h }))
          : undefined,
        aspect_ratio: aspect,
        // Pipeline LUON dung 20 giay: `ai.service.ts` doc `project.duration_sec`,
        // ma bang `projects` KHONG CO cot do, nen no luon rot ve mac dinh 20.
        // Gui 30 la bia mot con so khong ai ton trong — va con lam cong QA bao
        // lech 33% o MOI lan dung (nguong canh bao la 20%).
        duration_seconds: thoiLuong,
        package_type: selectedPackage,

        // Ba trường dưới đây là chỗ chuỗi từng bị ĐỨT: giao diện có đủ thông tin
        // nhưng không gửi xuống, nên worker không bao giờ biết khách chọn luồng clip.
        //
        // `source_mode` quyết định worker chạy nhánh nào: 'video_edit' đi hai lần gọi
        // LLM để dựng lại, còn lại đi chuỗi 4 tầng để sáng tác.
        source_mode: sourceMode === 'video' ? 'video_edit' : 'images',
        theme: sourceMode === 'video' ? theme : undefined,
        // Lời khách là nguồn SỐ 1 của cờ music_bed_likely, được ưu tiên hơn phép đo
        // RMS ở worker.
        has_background_music: sourceMode === 'video' ? coNhacKhiQuay : undefined,
      };

      // Giu lai de buoc dung dung y nguyen, khong dung lai mot lan nua.
      setDuAnDaLuu(project);
      setRawInputSan(rawInput);

      setDangDoc(true);
      const { data: pa, error: loiPa } = await RenderService.layPhuongAn(project.id, rawInput);
      setDangDoc(false);

      if (loiPa || !pa) {
        // Khong lay duoc phuong an thi VAN cho dung — chi mat buoc chon, khong mat
        // ca video. Chan o day la bien mot tro ngai thanh mot that bai.
        toast({
          title: 'Không tải được gợi ý',
          description: 'Vẫn dựng được video với cách kể mặc định.',
        });
        setKetQuaPhuongAn(null);
      } else {
        setKetQuaPhuongAn(pa);
        setPhuongAnChon(0);
      }
      setHoiXacNhan(true);
      return;
    } catch (err: any) {
      if (isAbortOrLockError(err)) {
        console.warn('[NewProject] Lock error during prepare — suppressed:', err.message);
        toast({ title: 'Dự án đang được xử lý...', description: 'Vui lòng kiểm tra Dashboard.' });
        navigate(ROUTES.DASHBOARD);
        return;
      }
      toast({ title: 'Lỗi', description: err.message ?? 'Không chuẩn bị được dữ liệu', variant: 'destructive' });
    } finally {
      setCreating(false);
      setUploading(false);
      setDangDoc(false);
    }
  };

  /**
   * Dung video voi phuong an khach da tich.
   *
   * Gui NGUYEN VAN phuong an xuong, khong gui ten goc: gui ten thi worker sinh lai
   * tang 2 va hook ra se khac cai khach vua chon — cung kieu mat long tin voi viec
   * bao mot gia roi tru mot gia khac.
   */
  const dungVideo = async () => {
    setHoiXacNhan(false);
    if (creating || !duAnDaLuu || !rawInputSan) return;
    setCreating(true);

    try {
      const chon = ketQuaPhuongAn?.phuongAn?.[phuongAnChon];
      const rawInput = chon ? { ...rawInputSan, chien_luoc: chon.nguyenVan } : rawInputSan;
      const project = duAnDaLuu;

      toast({ title: 'Bắt đầu dựng video...', description: chon ? `Cách kể: ${nhanGoc(chon.gocTiepCan)}` : undefined });

      const { data: renderData, error: renderError } = await RenderService.createJob(project.id, renderMode, rawInput, aspect ?? '9:16');

      if (renderError || !renderData?.renderId) {
        toast({ title: 'Lỗi', description: renderError || 'Không thể bắt đầu render', variant: 'destructive' });
        setCreating(false);
        return;
      }

      setRenderJobId(renderData.renderId);
      setRenderStatus('pending');
      setRenderStartedAt(Date.now());
      setElapsedSec(0);
      setStep(4); // Advance to Render Progress Step
    } catch (err: any) {
      // Suppress Lock broken / steal errors gracefully
      if (isAbortOrLockError(err)) {
        console.warn('[NewProject] Lock error during create — suppressed:', err.message);
        toast({ title: 'Dự án đang được xử lý...', description: 'Vui lòng kiểm tra Dashboard.' });
        navigate(ROUTES.DASHBOARD);
        return;
      }
      toast({ title: 'Lỗi', description: err.message ?? 'Đã xảy ra lỗi không lưu được dự án', variant: 'destructive' });
    } finally {
      setCreating(false);
      // `uploading` PHẢI gỡ ở đây, không chỉ ở hai nhánh bên trong khối try.
      //
      // Nút bị khoá bởi `creating || uploading`. AssetService.uploadMultiple ném lỗi —
      // mạng rớt, file quá lớn, storage từ chối — thì luồng nhảy thẳng xuống catch và
      // bỏ qua cả hai lệnh setUploading(false). `uploading` kẹt true, nút đứng nguyên
      // "Lưu & Tải lên..." vĩnh viễn: bấm không được, không thông báo, dự án nằm lại
      // ở trạng thái draft.
      setUploading(false);
    }
  };

  const fileValidation = validateFiles(selectedFiles);

  /**
   * Thoi luong duoc phep, theo so anh khach da tai len.
   *
   * Do that 30/10 tren 26 du an: trung vi 3 anh. Voi 3 anh, mot video 45 giay cho moi
   * anh dung hinh 15,2 giay — dung thu nguoi ban da keu "chuyen canh chi la phong to
   * anh dan". Ban thoi luong dai cho nguoi chi co ba tam anh la ban mot video te hon,
   * roi thu nhieu tien hon vi no te hon.
   */
  const soAnhDaChon = fileValidation.images.length;

  /**
   * Chieu NGAN that cua tung anh, doc ngay tren trinh duyet.
   *
   * Vi sao phai do: do that ngay 30/10 tren 40 anh khach da tai len cho trung vi
   * 1024px va nho nhat 300px — chi 16/40 du pixel de cat can 1,28x ma van net.
   * Dem so anh thi coi tam 300px ngang hang tam 2296px, trong khi mot tam gánh duoc
   * mot canh con tam kia ganh duoc ba.
   *
   * `createImageBitmap` doc duoc kich thuoc ma khong phai ve ra DOM. Doc hong thi de
   * trong, va `soCanhMoiAnh` lui ve 2 — dung voi trung vi do that.
   */
  const [canhNganAnh, setCanhNganAnh] = useState<Array<{ canhNgan?: number }>>([]);

  useEffect(() => {
    let huy = false;
    const anh = fileValidation.images;
    if (anh.length === 0) { setCanhNganAnh([]); return; }

    Promise.all(anh.map(async (file: File) => {
      try {
        const bm = await createImageBitmap(file);
        const canhNgan = Math.min(bm.width, bm.height);
        bm.close?.();
        return { canhNgan };
      } catch {
        return {};
      }
    })).then((ra) => { if (!huy) setCanhNganAnh(ra); });

    return () => { huy = true; };
  }, [soAnhDaChon, fileValidation.images.map((f: File) => `${f.name}:${f.size}`).join('|')]);

  const nguonLieu = { anh: canhNganAnh, soClip: fileValidation.videos.length };
  const mocChoPhep = mocThoiLuongChoPhep(nguonLieu);

  /**
   * Keo thoi luong ve moc hop le khi khach bot anh di.
   *
   * Khong co doan nay thi khach chon 45 giay voi 5 anh, xoa bot con 3 anh, va van bi
   * tru 3 credit cho mot video pipeline khong du lieu de dung.
   */
  useEffect(() => {
    if (!mocChoPhep.some((m) => m.giay === thoiLuong)) {
      setThoiLuong(mocChoPhep[mocChoPhep.length - 1].giay);
    }
  }, [soAnhDaChon, canhNganAnh, fileValidation.videos.length]);

  // Gia va giai thich, tinh tu dung nhung lua chon khach thay tren man hinh.
  // Cung cong thuc voi backend — co test canh o backend/tests/credit-cost-sync.test.ts.
  const specGia = specFromChoices({ durationSec: thoiLuong, renderMode });
  const giaCredit = creditsFor(specGia);
  const dongGiai = giaiThichCredit(specGia);
  const thieuCredit = soDu !== null && soDu < giaCredit;

  useEffect(() => {
    let huy = false;
    CreditService.getBalance().then(({ balance }) => {
      if (!huy) setSoDu(balance);
    });
    return () => { huy = true; };
  }, []);

  const selectedPkgInfo = selectedPackage ? PACKAGES[selectedPackage] : null;

  if (isLoadingDraft) return <LoadingState message="Đang tải dữ liệu dự án nháp..." />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Tạo dự án mới</h1>
          <p className="text-sm text-muted-foreground">Hoàn thành {steps.length} bước để thiết lập dự án.</p>
        </div>
        {selectedPkgInfo && step > 0 && (
          // Nhãn này có viền và biểu tượng nên TRÔNG như bấm được — trước đây bấm
          // không có gì xảy ra. Hoặc cho nó làm việc, hoặc bỏ vẻ ngoài của nút;
          // cho làm việc hữu ích hơn: quay lại bước chọn gói.
          <button
            type="button"
            onClick={() => setStep(0)}
            title="Đổi gói video"
            className="shrink-0 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5"
          >
            📦 {selectedPkgInfo.name}
            <Settings2 className="w-3 h-3 opacity-70" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
              i < step ? 'bg-primary text-primary-foreground' : i === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>
              {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span className={cn('text-xs hidden sm:inline', i <= step ? 'text-foreground' : 'text-muted-foreground')}>
              {s}
            </span>
            {i < steps.length - 1 && <div className={cn('flex-1 h-px', i < step ? 'bg-primary' : 'bg-border')} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Bước 1: Chọn gói video phù hợp mục tiêu:</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {PACKAGE_LIST.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg.id)}
                    className={cn(
                      'rounded-xl p-4 text-left transition-all border',
                      selectedPackage === pkg.id
                        ? 'border-primary bg-primary/5 shadow-card-hover'
                        : 'border-border bg-card shadow-card hover:shadow-card-hover'
                    )}
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <Video className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <h3 className="font-display text-sm font-bold text-foreground">{pkg.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">{pkg.description}</p>
                    <span className="text-[10px] text-muted-foreground">⏱ {pkg.duration}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
             <div className="space-y-4">
               <p className="text-sm text-muted-foreground">
                 Bước 2: Chọn cách làm video cho <span className="text-primary font-medium">{selectedPkgInfo?.name}</span>:
               </p>

               {/*
                 HAI CỬA NGANG NHAU, không phải một cửa chính và một nút phụ.

                 Hai luồng này chạy bằng kiến trúc khác hẳn nhau: luồng ảnh đi qua chuỗi
                 4 tầng để SÁNG TÁC kịch bản; luồng clip chỉ hai lần gọi LLM để DỰNG LẠI
                 thứ đã có. Nếu giao diện trình bày luồng clip như một tuỳ chọn phụ thì
                 gần như không ai dùng, và nó là luồng cho ra video tự nhiên nhất.
               */}
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <button
                   onClick={() => setSourceMode('images')}
                   className={cn(
                     'rounded-xl border p-4 text-left transition-all',
                     sourceMode === 'images'
                       ? 'border-primary bg-primary/5'
                       : 'border-border bg-card hover:border-primary/40'
                   )}
                 >
                   <span className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
                     <Image className="w-4 h-4 text-primary" /> Từ ảnh sản phẩm
                   </span>
                   <span className="block text-xs text-muted-foreground">
                     Hệ thống tự viết kịch bản và dựng video từ ảnh của bạn.
                   </span>
                 </button>

                 <button
                   onClick={() => setSourceMode('video')}
                   className={cn(
                     'rounded-xl border p-4 text-left transition-all',
                     sourceMode === 'video'
                       ? 'border-primary bg-primary/5'
                       : 'border-border bg-card hover:border-primary/40'
                   )}
                 >
                   <span className="flex items-center gap-2 text-sm font-medium text-foreground mb-1">
                     <Video className="w-4 h-4 text-primary" /> Từ video tôi tự quay
                   </span>
                   <span className="block text-xs text-muted-foreground">
                     Giữ hình bạn quay và giọng bạn nói, dựng lại cho gọn và rõ.
                   </span>
                 </button>
               </div>

               {/* ── Theme: chỉ có nghĩa với luồng clip ── */}
               {sourceMode === 'video' && (
                 <div className="space-y-2">
                   <Label className="text-xs text-muted-foreground">Kiểu dựng</Label>
                   <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                     {THEME_CARDS.map((t) => (
                       <button
                         key={t.key}
                         onClick={() => setTheme(t.key)}
                         className={cn(
                           'rounded-lg border p-2.5 text-left transition-all',
                           theme === t.key
                             ? 'border-primary bg-primary/5'
                             : 'border-border bg-card hover:border-primary/40'
                         )}
                       >
                         <span className="block text-xs font-medium text-foreground">{t.label}</span>
                         <span className="block text-[10px] text-muted-foreground mt-0.5 leading-snug">{t.hint}</span>
                       </button>
                     ))}
                   </div>

                   {/*
                     Ô tick này KHÔNG phải tiện ích.

                     Nó là nguồn số 1 của cờ `music_bed_likely` ở worker, và lời khách
                     được ưu tiên hơn phép đo RMS. Cờ đó quyết định có được đảo thứ tự
                     cảnh hay không — đảo cảnh trên clip có nhạc làm bài hát nhảy ngược.
                   */}
                   <label className="flex items-start gap-2 pt-1 cursor-pointer">
                     <input
                       type="checkbox"
                       checked={coNhacKhiQuay}
                       onChange={(e) => setCoNhacKhiQuay(e.target.checked)}
                       className="mt-0.5 accent-primary"
                     />
                     <span className="text-[11px] text-muted-foreground">
                       Tôi có phát nhạc khi quay.
                       <span className="block text-foreground/70">
                         Nếu có, hệ thống sẽ giữ nguyên thứ tự cảnh để bài nhạc không bị nhảy, và không thêm nhạc khác.
                       </span>
                     </span>
                   </label>
                 </div>
               )}
 
               {(
                 <div className="space-y-3 mt-4">
                   <div className="space-y-1.5">
                     <Label htmlFor="sourceUrl" className="text-xs text-muted-foreground">
                       Link sản phẩm <span className="text-muted-foreground/60">— không bắt buộc, chỉ để lấy tên và giá</span>
                     </Label>
                     <Input
                       id="sourceUrl"
                       placeholder="https://shopee.vn/..."
                       value={sourceUrl}
                       onChange={(e) => setSourceUrl(e.target.value)}
                       className="bg-card"
                     />
                     {sourceUrl && sourceUrl.trim().length <= 5 && (
                       <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                         <AlertCircle className="w-3 h-3" /> URL phải hợp lệ
                       </p>
                     )}
                   </div>

                   {/*
                     Spec V3 §2.3: "UI phải nói rõ điều này."

                     Link chỉ dùng làm ngữ cảnh văn bản. KHÔNG tự tải ảnh từ link, vì hai
                     lý do: điều khoản của sàn, và ảnh trên sàn thường mang watermark của
                     người bán khác. Trước đây ô nhập này không nói gì, nên người bán dán
                     link rồi bấm tiếp và tưởng là xong — dẫn tới dự án không có ảnh nào.
                   */}
                   <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex gap-2">
                     <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                     <div className="text-[11px] text-muted-foreground space-y-1">
                       <p className="text-foreground font-medium">Link chỉ lấy phần chữ, không lấy ảnh</p>
                       <p>
                         Hệ thống dùng link để hiểu tên, giá và mô tả sản phẩm. Ảnh trên sàn
                         thường có watermark của người bán khác và việc tự tải về vi phạm
                         điều khoản nền tảng, nên <span className="text-foreground">bạn vẫn cần tải ảnh hoặc clip của mình lên</span>.
                       </p>
                     </div>
                   </div>
                   <div className="space-y-1.5">
                     <Label htmlFor="notes" className="text-xs text-muted-foreground">Mô tả sản phẩm</Label>
                     <Textarea
                       id="notes"
                       placeholder="VD: Son lì 24h, không trôi khi uống nước, 6 màu, giá 250k..."
                       value={manualNotes}
                       onChange={(e) => setManualNotes(e.target.value)}
                       className="bg-card resize-none h-20"
                       maxLength={500}
                     />
                   </div>

                   {/*
                     Bốn ô lái kịch bản.

                     Thiếu chúng, AI tự đoán toàn bộ góc kể — và khi ảnh không nhất
                     quán thì nó bịa ra một câu chuyện nối chúng lại, như video ngày
                     29/10 hỏi "Đang chọn đồng hồ hay laptop?" vì ba ảnh là đồng hồ,
                     tai nghe và laptop.
                   */}
                   <div className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-3">
                     <p className="text-xs font-medium text-foreground">
                       Lái kịch bản <span className="font-normal text-muted-foreground">— để trống thì AI tự quyết</span>
                     </p>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                       <div className="space-y-1">
                         <Label className="text-[11px] text-muted-foreground">Lợi ích chính cần nhấn</Label>
                         <Input
                           value={loiIchChinh}
                           onChange={(e) => setLoiIchChinh(e.target.value)}
                           placeholder="VD: không trôi cả ngày"
                           className="h-8 text-sm bg-card"
                           maxLength={120}
                         />
                       </div>
                       <div className="space-y-1">
                         <Label className="text-[11px] text-muted-foreground">Bán cho ai</Label>
                         <Input
                           value={doiTuong}
                           onChange={(e) => setDoiTuong(e.target.value)}
                           placeholder="VD: nữ văn phòng 25–35"
                           className="h-8 text-sm bg-card"
                           maxLength={120}
                         />
                       </div>
                     </div>

                     <div className="space-y-1">
                       <Label className="text-[11px] text-muted-foreground">Giọng điệu</Label>
                       <div className="flex flex-wrap gap-1.5">
                         {['Thân mật', 'Chuyên nghiệp', 'Gấp gáp', 'Nhẹ nhàng'].map((g) => (
                           <button
                             key={g}
                             type="button"
                             onClick={() => setGiongDieu(giongDieu === g ? '' : g)}
                             className={cn(
                               'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                               giongDieu === g
                                 ? 'border-primary bg-primary/10 text-primary'
                                 : 'border-border bg-card text-muted-foreground hover:text-foreground'
                             )}
                           >
                             {g}
                           </button>
                         ))}
                       </div>
                     </div>

                     <div className="space-y-1">
                       <Label className="text-[11px] text-muted-foreground">
                         Điều KHÔNG được nói
                         <span className="ml-1.5 opacity-70">— chặn trước, không phải sửa sau</span>
                       </Label>
                       <Input
                         value={khongDuocNoi}
                         onChange={(e) => setKhongDuocNoi(e.target.value)}
                         placeholder="VD: đừng nhắc giá, đừng so sánh với hãng khác"
                         className="h-8 text-sm bg-card"
                         maxLength={200}
                       />
                     </div>
                   </div>
                 </div>
               )}
 
               {(
                 <div className="space-y-3 mt-4">
                   <div
                     onDragOver={(e) => e.preventDefault()}
                     onDrop={handleFileDrop}
                     onClick={() => fileInputRef.current?.click()}
                     className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/40 transition-colors cursor-pointer bg-card/30"
                   >
                     <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                     <p className="text-sm text-foreground font-medium mb-1">
                       {sourceMode === 'video' ? 'Kéo thả clip bạn tự quay' : 'Kéo thả hoặc click để upload'}
                     </p>
                     <p className="text-xs text-muted-foreground">
                       {sourceMode === 'video'
                         ? 'Tới 3 clip, mỗi clip dưới 30 giây và tối đa 100MB'
                         : '3–8 ảnh (tối đa 20MB) · có thể thêm clip tự quay'}
                     </p>
                   </div>

                   {/*
                     Gợi ý quay — spec V3 §2.4.

                     Clip tự quay là thứ ảnh tĩnh không bao giờ thay được: tay người cầm
                     sản phẩm, ánh sáng thật, vật chuyển động thật. Nhưng người bán không
                     biết cần quay gì, nên hoặc bỏ qua, hoặc quay một đoạn dài vô định
                     không dùng được cảnh nào. Vài dòng gợi ý ở đây rẻ hơn nhiều so với
                     việc họ render ra một video xấu rồi mới biết.
                   */}
                   <div className={cn(
                     'mt-3 rounded-lg border border-border/60 bg-card/40 p-3 space-y-2',
                     sourceMode === 'video' ? '' : 'opacity-70'
                   )}>
                     <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                       <Video className="w-3.5 h-3.5 text-primary" />
                       {sourceMode === 'video' ? 'Quay thế nào cho dễ dựng' : 'Quay clip ngắn để video tự nhiên hơn'}
                     </p>
                     <ul className="text-[11px] text-muted-foreground space-y-1 pl-4 list-disc">
                       <li><span className="text-foreground">Cầm trên tay</span> — mở nắp, xoay nhẹ cho thấy sản phẩm thật, 4–5 giây</li>
                       <li><span className="text-foreground">Cận cảnh chất liệu</span> — quay sát vào bề mặt, đường may, hoặc kết cấu, 3–4 giây</li>
                       <li><span className="text-foreground">Đang dùng thật</span> — cảnh thuyết phục nhất, và là thứ ảnh tĩnh không có</li>
                     </ul>
                     <p className="text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                       Cầm điện thoại <span className="text-foreground">dọc</span>, quay nơi đủ sáng, mỗi clip <span className="text-foreground">dưới 30 giây</span>.
                       Nếu máy đang quay 4K, đổi về 1080p — video thành phẩm trông y hệt mà tải lên nhanh gấp ba.
                       Hệ thống tự chọn đoạn đẹp nhất và <span className="text-foreground">giữ nguyên giọng bạn</span>.
                     </p>

                     {/*
                       KHÔNG hứa "nhạc sẽ bị bỏ".

                       Giọng và nhạc trong file khách nộp là MỘT dạng sóng; không có source
                       separation thì không tách được. Hứa bỏ nhạc là hứa một việc không làm
                       được — và bỏ cả khối tiếng thì mất luôn giọng khách, tức phá đúng thứ
                       luồng này tồn tại để giữ.

                       Thứ nói thật và có ích: đừng mở nhạc lúc quay, và nếu đã lỡ thì đây
                       là hệ quả.
                     */}
                     <p className="text-[11px] text-warning/90 flex gap-1.5 pt-1">
                       <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                       <span>
                         Quay chỗ yên, <span className="text-foreground">đừng mở nhạc</span>. Nhạc thu lẫn vào
                         giọng thì không xoá được, và sẽ bị ngắt mỗi lần cắt cảnh.
                       </span>
                     </p>
                   </div>
                   <input
                     ref={fileInputRef}
                     type="file"
                     multiple
                     accept={[...AssetService.ACCEPTED_IMAGE_TYPES, ...AssetService.ACCEPTED_VIDEO_TYPES].join(',')}
                     onChange={handleFileSelect}
                     className="hidden"
                   />
 
                   {selectedFiles.length > 0 && (
                     <div className="space-y-2 mt-4">
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                         <p className="text-xs font-medium text-foreground">
                           {getFileCountMessage(fileValidation.images, fileValidation.videos)}
                         </p>
                         {selectedFiles.length < 3 && (
                           <p className="text-xs text-warning flex items-center gap-1">
                             <AlertCircle className="w-3 h-3" /> Cần tối thiểu 3 ảnh
                           </p>
                         )}
                       </div>
                       <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                         {selectedFiles.map((file, i) => (
                           <div key={i} className="relative group aspect-square rounded-lg bg-muted border border-border overflow-hidden">
                             {file.type.startsWith('image/') ? (
                               <img
                                 src={URL.createObjectURL(file)}
                                 alt={file.name}
                                 className="w-full h-full object-cover"
                               />
                             ) : (
                               <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-secondary">
                                 <FileVideo className="w-5 h-5 text-primary" />
                                 <span className="text-[9px] text-muted-foreground truncate px-1 max-w-full">{file.name}</span>
                               </div>
                             )}
                             <button
                               onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                               className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                             >
                               <X className="w-3 h-3" />
                             </button>
                           </div>
                         ))}
                         {selectedFiles.length < 9 && (
                           <button
                             onClick={() => fileInputRef.current?.click()}
                             className="aspect-square rounded-lg bg-card border-2 border-dashed border-border flex items-center justify-center hover:border-primary/40 transition-colors"
                           >
                             <Image className="w-4 h-4 text-muted-foreground" />
                           </button>
                         )}
                       </div>
                     </div>
                   )}
 
                   {fileValidation.errors.length > 0 && (
                     <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 mt-2 space-y-1">
                       {fileValidation.errors.map((err, i) => (
                         <p key={i} className="text-xs text-destructive flex items-start gap-1.5 leading-tight">
                           <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                           <span>{err.file ? `${err.file}: ` : ''}{err.message}</span>
                         </p>
                       ))}
                     </div>
                   )}
                 </div>
               )}
             </div>
           )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Bước 3: Chọn danh mục sản phẩm của bạn để AI phân tích chuẩn xác hơn:</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      'rounded-xl p-4 text-left transition-all border flex items-center gap-3',
                      selectedCategory === cat.id
                        ? 'border-primary bg-primary/5 shadow-card-hover'
                        : 'border-border bg-card shadow-card hover:shadow-card-hover'
                    )}
                  >
                    <span className="text-2xl">{cat.emoji}</span>
                    <div>
                      <h3 className="font-display text-sm font-semibold text-foreground">{cat.label}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{cat.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-4">
                 <p className="text-sm text-muted-foreground">Bước 4: Cấu hình Render Options & Lưu nháp dự án.</p>
                 
                 <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                       <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Maximize className="w-3.5 h-3.5" /> Tỉ lệ (Aspect Ratio)</Label>
                       <div className="grid grid-cols-3 gap-2">
                         {['9:16', '16:9', '1:1'].map((ratio) => (
                           <button
                             key={ratio}
                             onClick={() => setAspect(ratio as any)}
                             className={cn(
                               'rounded-lg p-3 text-center transition-all border flex flex-col items-center gap-2',
                               aspect === ratio ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground'
                             )}
                           >
                             <div className={cn('border-2 border-current rounded', ratio === '9:16' ? 'w-4 h-6' : ratio === '16:9' ? 'w-6 h-4' : 'w-5 h-5')} />
                             <span className="text-[10px] font-bold">{ratio}</span>
                           </button>
                         ))}
                       </div>
                    </div>

                    <div className="space-y-2">
                       <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Box className="w-3.5 h-3.5" /> Export Mode</Label>
                       <div className="flex flex-col gap-2">
                          {EXPORT_MODES.map(mode => (
                            <button key={mode.id} onClick={() => setExportMode(mode.id as any)} className={cn('rounded-lg px-3 py-2 text-left text-xs transition-colors border', exportMode === mode.id ? 'border-primary bg-primary/5 text-foreground font-medium' : 'border-border bg-card text-muted-foreground hover:bg-muted/50')}>
                               {mode.name}
                            </button>
                          ))}
                       </div>
                    </div>
                 </div>

                 <div className="space-y-2 pt-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Settings2 className="w-3.5 h-3.5" /> Kiểu Render
                      <span className="text-[10px] font-normal text-muted-foreground/70">· Premium Cloud đang khoá trong Admin Settings</span>
                    </Label>
                    <div className="grid sm:grid-cols-3 gap-2">
                      <button onClick={() => setRenderMode('draft_local')} className={cn('rounded-lg p-3 text-left transition-all border', renderMode === 'draft_local' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card opacity-80 hover:opacity-100')}>
                         <span className="text-xs font-semibold text-foreground block">Draft Local (Free)</span>
                         <span className="text-[10px] text-muted-foreground block mt-0.5">Video có chữ và nhạc nền, chưa có giọng đọc.</span>
                      </button>
                      {/* Lồng tiếng chạy thật qua FPT Token Factory từ 28/10/2026.
                          Đo lại 29/10: một câu 48 ký tự ra file 3,5 giây trong 870ms.

                          `render.worker.ts` chỉ sinh giọng cho ĐÚNG chế độ này — trước đây
                          bật TTS là mọi video đều có giọng, kể cả bản miễn phí.

                          Chế độ này tốn thêm 1 credit; màn hình chọn trước khi dựng nêu rõ. */}
                      <button
                        onClick={() => setRenderMode('draftlocaltts')}
                        className={cn(
                          'rounded-lg p-3 text-left transition-all border',
                          renderMode === 'draftlocaltts'
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border bg-card opacity-80 hover:opacity-100'
                        )}
                      >
                         <span className="text-xs font-semibold text-foreground block">Draft + Giọng đọc</span>
                         <span className="text-[10px] text-muted-foreground block mt-0.5">
                           Có giọng đọc tiếng Việt và phụ đề khớp từng câu.
                         </span>
                      </button>
                      
                      {(!settings.PREMIUMRENDERENABLED || settings.LOCALONLYMODE) ? (
                         <div
                            aria-disabled="true"
                            title="Khoá trong Admin Settings (PREMIUM_RENDER_ENABLED)"
                            className="rounded-lg p-3 border border-dashed border-border/50 bg-background/40 flex flex-col justify-center cursor-not-allowed select-none"
                         >
                            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                              <Lock className="w-3 h-3 shrink-0" /> Premium Cloud
                            </span>
                            <span className="text-[10px] text-muted-foreground/80 mt-0.5">Đang khoá trong Admin Settings.</span>
                         </div>
                      ) : (
                        <button onClick={() => setRenderMode('premiumcloud')} className={cn('rounded-lg p-3 text-left transition-all border border-info/40 bg-info/5', renderMode === 'premiumcloud' ? 'shadow-sm ring-1 ring-info' : 'hover:bg-info/10')}>
                           <span className="text-xs font-semibold text-info flex items-center gap-1"><Cloud className="w-3.5 h-3.5" /> Premium Cloud</span>
                           <span className="text-[10px] text-info/80 block mt-0.5">Sử dụng tài nguyên server cloud mạnh nhất.</span>
                        </button>
                      )}
                    </div>
                 </div>
              </div>

               {/*
                 Thời lượng — thứ DUY NHẤT quyết định giá.

                 Mỗi nút hiện luôn số credit của nó. Bảng giá nào bắt khách bấm xong
                 mới biết mất bao nhiêu thì bảng đó đang giấu gì đó.

                 Trần 45 giây không phải con số tròn cho đẹp: schema tầng 1 và tầng 3
                 đều kẹp `duration_sec` trong 10..45, nên cho chọn 60 là bán một thứ
                 pipeline không dựng được.
               */}
               <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
                 <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                   <Clock className="w-4 h-4 text-primary" /> Thời lượng video
                 </p>

                 <div className="grid grid-cols-4 gap-2">
                   {MOC_THOI_LUONG.map((m) => {
                     const khoa = viSaoKhoaMoc(m.giay, nguonLieu);
                     return (
                       <button
                         key={m.giay}
                         type="button"
                         disabled={!!khoa}
                         title={khoa || undefined}
                         onClick={() => setThoiLuong(m.giay)}
                         className={cn(
                           'rounded-lg border p-2.5 text-center transition-all',
                           khoa
                             ? 'border-dashed border-border/50 bg-background/20 cursor-not-allowed opacity-50'
                             : thoiLuong === m.giay
                               ? 'border-primary bg-primary/10 ring-1 ring-primary'
                               : 'border-border bg-background/40 hover:bg-muted/50'
                         )}
                       >
                         <span className="block text-sm font-semibold text-foreground">{m.nhan}</span>
                         <span className="block text-[11px] text-muted-foreground mt-0.5">
                           {m.credit} credit
                         </span>
                       </button>
                     );
                   })}
                 </div>

                 {/* Noi RO can bao nhieu anh de mo moc dai hon — khach lam duoc gi voi
                     thong tin do, chu khong phai mot nut xam khong giai thich. */}
                 {mocChoPhep.length < MOC_THOI_LUONG.length && (
                   <p className="text-[11px] text-amber-700 dark:text-amber-400">
                     {viSaoKhoaMoc(MOC_THOI_LUONG[mocChoPhep.length].giay, nguonLieu)}
                   </p>
                 )}

                 <p className="text-[11px] text-muted-foreground">
                   1 credit cho mỗi 15 giây. Giọng đọc, độ phân giải và bỏ watermark
                   không tính thêm.
                 </p>
               </div>

               {/*
                 Hai tuỳ chọn làm sạch video.

                 "Không chèn chữ": nhiều người bán muốn video sạch để tự gõ caption
                 trong TikTok — caption gõ trong ứng dụng được nền tảng đọc và phân
                 phối tốt hơn chữ cháy sẵn.

                 "Cắt viền": bỏ logo/watermark ở góc ảnh. Không có nhận dạng tự động,
                 và đó là chủ ý — dò logo sai thì nó xoá mất sản phẩm.
               */}
               <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
                 <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                   <Type className="w-4 h-4 text-primary" /> Làm sạch video
                 </p>

                 <label className="flex items-start gap-2.5 cursor-pointer">
                   <input
                     type="checkbox"
                     checked={khongChenChu}
                     onChange={(e) => setKhongChenChu(e.target.checked)}
                     className="mt-0.5 accent-primary"
                   />
                   <span className="text-xs text-muted-foreground">
                     <span className="text-foreground font-medium">Không chèn chữ lên video</span>
                     <span className="block mt-0.5">
                       Bỏ cả chữ tiêu đề lẫn phụ đề. Phù hợp khi bạn muốn tự gõ caption
                       trong TikTok — caption gõ trong app được phân phối tốt hơn.
                     </span>
                   </span>
                 </label>

                 {/*
                   Dò dấu bản quyền — ĐỀ XUẤT, không tự xoá.

                   Đo ngày 31/10 trên 10 dự án thật: bộ dò tìm đúng dấu trên 2 dự án,
                   loại sạch chữ của sản phẩm trên 6, nhưng vẫn cho dương tính giả
                   trên 2 — "ninhle.com" in trên vỏ hộp, và rác OCR đọc thành "qua".

                   Về mặt pixel, dấu của sàn và chữ in trên hộp giống hệt nhau. Chỉ
                   người bán mới biết cái nào là của mình. Nên hiện ảnh cắt ra cho họ
                   nhìn, rồi để họ tích — không bao giờ xoá tự động.
                 */}
                 <div className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2.5">
                   <div className="flex items-center justify-between gap-2">
                     <span className="text-xs font-medium text-foreground">
                       Dấu bản quyền trên ảnh
                     </span>
                     <Button
                       type="button"
                       size="sm"
                       variant="outline"
                       className="h-7 text-[11px]"
                       disabled={dangTimDau || !duAnDaLuu?.id}
                       onClick={async () => {
                         if (!duAnDaLuu?.id) return;
                         setDangTimDau(true);
                         const kq = await RenderService.timDau(duAnDaLuu.id);
                         setDangTimDau(false);
                         setDauTimDuoc(kq.dau);
                         setDauDaTich(new Set());
                         setGiuLaiNeuChonHet(kq.giuLaiNeuChonHet);
                         setNhanTimDau(kq.batDuoc ? kq.nhan : 'Máy dựng chưa bật bộ nhận chữ.');
                       }}
                     >
                       {dangTimDau ? 'Đang dò…' : dauTimDuoc ? 'Dò lại' : 'Dò dấu'}
                     </Button>
                   </div>

                   {!duAnDaLuu?.id && (
                     <p className="text-[11px] text-muted-foreground">
                       Bấm "Hoàn thành & Render" trước để tải ảnh lên, rồi quay lại dò dấu.
                     </p>
                   )}

                   {nhanTimDau && (
                     <p className="text-[11px] text-muted-foreground">{nhanTimDau}</p>
                   )}

                   {dauTimDuoc && dauTimDuoc.length > 0 && (
                     <>
                       <p className="text-[11px] text-muted-foreground">
                         Tích vào dấu <strong className="text-foreground">của bạn</strong> cần bỏ.
                         Chữ in trên chính sản phẩm thì đừng tích — hệ thống không phân biệt được.
                       </p>
                       <div className="space-y-2">
                         {dauTimDuoc.map((d, i) => (
                           <label key={i} className="flex items-center gap-2.5 cursor-pointer">
                             <input
                               type="checkbox"
                               checked={dauDaTich.has(i)}
                               onChange={(e) => {
                                 const moi = new Set(dauDaTich);
                                 if (e.target.checked) moi.add(i); else moi.delete(i);
                                 setDauDaTich(moi);
                               }}
                               className="accent-primary shrink-0"
                             />
                             {d.anhNho && (
                               <img
                                 src={d.anhNho}
                                 alt={d.text}
                                 className="h-8 rounded border border-border/60 bg-black/20 object-contain"
                               />
                             )}
                             <span className="text-[11px] text-muted-foreground min-w-0">
                               <span className="text-foreground font-medium">"{d.text}"</span>
                               {' '}— thấy trên {d.soAnh} ảnh, ở {Math.round(d.y * 100)}% từ đỉnh
                             </span>
                           </label>
                         ))}
                       </div>
                       {dauDaTich.size > 0 && (
                         <p className="text-[11px] text-amber-700 dark:text-amber-400">
                           Ảnh sẽ được cắt tránh dấu, giữ lại khoảng{' '}
                           {Math.round(giuLaiNeuChonHet * 100)}% diện tích. Cắt tránh không
                           để lại vệt như cách xoá dấu.
                         </p>
                       )}
                     </>
                   )}
                 </div>

                 <label className="flex items-start gap-2.5 cursor-pointer">
                   <input
                     type="checkbox"
                     checked={catVienAnh}
                     onChange={(e) => setCatVienAnh(e.target.checked)}
                     className="mt-0.5 accent-primary"
                   />
                   <span className="text-xs text-muted-foreground">
                     <span className="text-foreground font-medium">Cắt viền ảnh để bỏ logo góc</span>
                     <span className="block mt-0.5">
                       Cắt 8% quanh mép mỗi ảnh — chỗ các sàn thường đóng dấu. Ảnh có
                       sản phẩm sát mép thì đừng bật.
                     </span>
                   </span>
                 </label>
               </div>


               {uploading && uploadProgress.length > 0 && (
                 <div className="rounded-xl p-4 bg-card border border-border space-y-2 mt-4 animate-in fade-in zoom-in-95">
                   <p className="text-xs font-medium text-foreground flex items-center gap-2">
                     <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Đang upload tài sản...
                   </p>
                   {uploadProgress.map((p, i) => (
                     <div key={i} className="flex items-center gap-2 bg-background py-1.5 px-3 rounded text-xs border border-border/50">
                       <span className="text-muted-foreground truncate w-40">{p.fileName}</span>
                       <span className="text-[10px] text-muted-foreground ml-auto">{p.progress}%</span>
                       {p.status === 'done' && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                       {p.status === 'uploading' && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />}
                       {p.status === 'error' && <AlertCircle className="w-4 h-4 text-destructive shrink-0" />}
                     </div>
                   ))}
                 </div>
               )}
            </div>
          )}

          {step === 4 && (
             <div className="space-y-6">
               <div className="text-center space-y-2 mb-8">
                 <h2 className="text-xl font-bold text-foreground">
                   {renderStatus === 'completed' ? 'Video Đã Hoàn Tất 🎉' : 
                    renderStatus === 'failed' ? 'Lỗi Tạo Video' : 
                    'AI Đạo Diễn Đang Làm Việc...'}
                 </h2>
                 <p className="text-sm text-muted-foreground">
                   {renderStatus === 'completed' ? 'Tải video của bạn bên dưới' :
                    renderStatus === 'failed' ? renderError : 
                    renderProgress < 5 ? 'Đang khởi tạo công việc...' :
                    renderProgress < 10 ? 'Phân tích thông tin sản phẩm (Product Intel)...' :
                    renderProgress < 15 ? 'Lên chiến lược & Kịch bản (Video Strategy)...' :
                    renderProgress < 20 ? 'Tạo đồ thị cảnh (Scene Graph)...' :
                    'Đang kết xuất video và hiệu ứng...'}
                 </p>
               </div>

               <div className="max-w-md mx-auto space-y-6">
                 {renderStatus === 'completed' && renderOutputUrl ? (
                   <div className="space-y-4">
                     <div className="aspect-[9/16] w-full max-w-[280px] mx-auto rounded-xl overflow-hidden border border-border shadow-lg bg-black">
                       <video
                         ref={videoRef}
                         src={renderOutputUrl}
                         poster={renderThumbUrl ?? undefined}
                         preload="metadata"
                         controls
                         playsInline
                         className="w-full h-full object-contain"
                       />
                     </div>

                     <div className="flex flex-wrap justify-center gap-2">
                       <Button size="sm" className="gap-1.5" onClick={() => videoRef.current?.play()}>
                         <PlayCircle className="w-4 h-4" /> Chạy thử
                       </Button>
                       <Button asChild size="sm" variant="outline" className="gap-1.5">
                         <a href={renderOutputUrl} download target="_blank" rel="noopener noreferrer">
                           <Save className="w-4 h-4" /> Tải về
                         </a>
                       </Button>
                       <Button size="sm" variant="ghost" onClick={() => navigate(ROUTES.DASHBOARD)}>
                         Về Dashboard
                       </Button>
                     </div>
                   </div>
                 ) : renderStatus === 'failed' || renderStatus === 'retryable_failed' ? (
                   <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-2">
                     <p className="text-sm font-medium text-foreground flex items-center gap-2">
                       <AlertCircle className="w-4 h-4 text-destructive shrink-0" /> Không dựng được video
                     </p>
                     <p className="text-xs text-muted-foreground break-words">{renderError}</p>
                   </div>
                 ) : (
                   <div className="space-y-3">
                     {/* Khung giữ chỗ đúng tỉ lệ video, để khách thấy trước video sẽ hiện ở đâu. */}
                     <div className="aspect-[9/16] w-full max-w-[280px] mx-auto rounded-xl border border-dashed border-border/60 bg-muted/30 flex flex-col items-center justify-center gap-2">
                       <Loader2 className="w-7 h-7 text-primary animate-spin" />
                       <span className="text-[11px] text-muted-foreground">Video sẽ hiện ở đây</span>
                     </div>

                     <Progress value={renderProgress} className="h-3" />
                     <div className="flex justify-between text-xs text-muted-foreground">
                       <span>{renderProgress < 20 ? 'AI Pipeline' : 'Đang dựng video'}</span>
                       <span className="font-medium text-foreground">{renderProgress}%</span>
                     </div>

                     {/* Dấu hiệu hệ thống còn sống: đứng yên ở 0% mà đồng hồ vẫn chạy thì
                         khách biết là đang chờ, không phải treo. */}
                     <p className="text-[11px] text-muted-foreground text-center">
                       Đã chờ {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, '0')}
                       {elapsedSec > 180 && ' — lâu hơn thường lệ, bạn có thể rời trang, video vẫn được dựng tiếp'}
                     </p>
                   </div>
                 )}
               </div>
             </div>
          )}

        </motion.div>
      </AnimatePresence>

        <div className="flex justify-between pt-6 border-t border-border mt-8">
        <div className="flex gap-2">
          {step < 4 && (
            <Button
              variant="outline"
              onClick={() => step === 0 ? navigate(ROUTES.DASHBOARD) : setStep(step - 1)}
              disabled={creating || uploading}
              className="w-32"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> {step === 0 ? 'Hủy' : 'Quay lại'}
            </Button>
          )}
          {step > 0 && step < 4 && (
            <Button
              variant="secondary"
              onClick={handleSaveExit}
              disabled={creating || uploading}
            >
              <Save className="w-4 h-4 mr-2" /> Lưu Nháp
            </Button>
          )}
        </div>
        {step < 3 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed(step)}
            className="w-32"
          >
            Tiếp tục <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : step === 3 ? (
          <div className="flex items-center gap-4">
            {/* Gia hien ngay canh nut, khong giau trong hop thoai: khach phai thay
                truoc khi quyet dinh bam, chu khong phai sau khi da bam. */}
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold text-foreground">
                {giaCredit} credit
              </div>
              <div className="text-[11px] text-muted-foreground">
                {soDu === null ? 'Đang xem số dư…' : `Còn ${soDu} → ${soDu - giaCredit}`}
              </div>
            </div>
            <Button
              className="glow-primary font-display min-w-40"
              onClick={handleCreate}
              disabled={!canProceed(3) || creating || uploading || thieuCredit}
            >
              {dangDoc ? (
                 <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang đọc ảnh...</>
              ) : creating || uploading ? (
                 <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lưu & Tải lên...</>
              ) : thieuCredit ? (
                 <>Không đủ credit</>
              ) : (
                 <><PlayCircle className="w-4 h-4 mr-2" /> Xem cách kể & Render</>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 justify-end w-full">
            <Button variant="outline" onClick={() => navigate(ROUTES.DASHBOARD)}>
              Về Dashboard
            </Button>
            {renderStatus === 'completed' && renderOutputUrl && (
              <Button asChild className="glow-primary">
                <a href={renderOutputUrl} download target="_blank" rel="noopener noreferrer">
                  Tải Video Xuống
                </a>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Hộp xác nhận: bóc tách TẠI SAO lại là con số đó, không chỉ nêu con số.
          Khách hỏi "sao trừ 2 credit" thì câu trả lời phải nằm sẵn ở đây, chứ không
          phải trong log của chúng ta. Cùng hàm `giaiThichCredit` mà backend ghi vào
          sổ cái, nên hai lời giải thích không thể lệch nhau. */}
      <AlertDialog open={hoiXacNhan} onOpenChange={setHoiXacNhan}>
        <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Chọn cách kể cho video này</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-1">

                {/* AI hiểu được gì — nói trước, vì nếu nó hiểu sai thì mọi phương án
                    bên dưới đều sai theo, và khách cần biết điều đó TRƯỚC khi tiêu
                    credit chứ không phải sau khi xem video. */}
                {ketQuaPhuongAn && (
                  <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      AI đọc được từ ảnh của bạn
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      {ketQuaPhuongAn.hieuDuoc.ten}
                    </div>
                    {ketQuaPhuongAn.hieuDuoc.moTa && (
                      <div className="text-sm text-muted-foreground">{ketQuaPhuongAn.hieuDuoc.moTa}</div>
                    )}
                    {ketQuaPhuongAn.hieuDuoc.loiIch.length > 0 && (
                      <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-0.5">
                        {ketQuaPhuongAn.hieuDuoc.loiIch.slice(0, 3).map((l) => <li key={l}>{l}</li>)}
                      </ul>
                    )}
                    <div className="text-[11px] text-muted-foreground pt-0.5">
                      Đọc được {ketQuaPhuongAn.hieuDuoc.soAnhDocDuoc}/{ketQuaPhuongAn.hieuDuoc.soAnhTaiLen} ảnh
                    </div>
                  </div>
                )}

                {/* Chỉ nêu thứ khách TỰ SỬA ĐƯỢC. "needs_human_review" là từ của hệ
                    thống, khách không làm gì với nó. */}
                {ketQuaPhuongAn && ketQuaPhuongAn.canSua.length > 0 && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                    <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                      Video sẽ tốt hơn nếu bạn bổ sung
                    </div>
                    <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                      {ketQuaPhuongAn.canSua.slice(0, 3).map((c) => <li key={c}>{c}</li>)}
                    </ul>
                    <div className="text-[11px] text-muted-foreground mt-1.5">
                      Vẫn dựng được ngay — đây chỉ là gợi ý.
                    </div>
                  </div>
                )}

                {/* Ba phương án. Hệ thống vẫn luôn sinh đủ ba rồi lấy cái đầu và vứt
                    hai cái còn lại — khách chưa từng biết mình có lựa chọn. */}
                {ketQuaPhuongAn && ketQuaPhuongAn.phuongAn.length > 0 && (
                  <div className="space-y-2">
                    {ketQuaPhuongAn.phuongAn.map((pa, i) => (
                      <button
                        key={pa.gocTiepCan}
                        type="button"
                        onClick={() => setPhuongAnChon(i)}
                        className={cn(
                          'w-full text-left rounded-lg border p-3 transition-all',
                          i === phuongAnChon
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border bg-card hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={cn(
                            'mt-0.5 w-4 h-4 rounded-full border-2 shrink-0',
                            i === phuongAnChon ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                          )} />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-foreground">
                              {NHAN_GOC[pa.gocTiepCan]?.ten ?? pa.gocTiepCan}
                            </div>
                            <div className="text-[11px] text-muted-foreground mb-1.5">
                              {NHAN_GOC[pa.gocTiepCan]?.giaiThich}
                            </div>
                            <div className="text-sm text-foreground italic">"{pa.hook}"</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Giá: cùng công thức với backend, có test canh hai bản. */}
                <div className="rounded-lg border border-border bg-muted/40 divide-y divide-border">
                  {dongGiai.map((d) => (
                    <div key={d.nhan} className="flex justify-between px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{d.nhan}</span>
                      <span className="font-medium text-foreground">+{d.credit}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-3 py-2 text-sm font-semibold">
                    <span className="text-foreground">Tổng cộng</span>
                    <span className="text-foreground">{giaCredit} credit</span>
                  </div>
                </div>

                {soDu !== null && (
                  <p className="text-sm text-muted-foreground">
                    Số dư <strong className="text-foreground">{soDu}</strong> credit,
                    sau khi dựng còn <strong className="text-foreground">{soDu - giaCredit}</strong>.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Chỉ trừ khi video dựng xong. Dựng thất bại thì không mất credit nào.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Quay lại</AlertDialogCancel>
            <AlertDialogAction onClick={dungVideo}>
              Dựng video
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default NewProject;
