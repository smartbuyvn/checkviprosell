/**
 * Viprosell — Script Workspace (Split-pane layout)
 * Left: script text, scene cards, overlays, captions, hashtags, thumbnail
 * Right: preview placeholder, render status, retry, export
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { creditsFor } from '@/lib/creditCost';
import { cn } from '@/lib/utils';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText, Play, Clock, Hash, Image, Type, Copy, Check,
  RefreshCw, Loader2, ChevronRight, ChevronLeft, Video,
  Download, AlertTriangle, Film, Sparkles, Monitor, Eye,
  Layers, MessageSquare, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/hooks/useSettings';
import { ScriptService } from '@/services/script.service';
import { ProjectService } from '@/services/project.service';
import { RenderService, type RenderJob } from '@/services/render.service';
import { AssetService, assetUrls } from '@/services/asset.service';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';

const PACKAGE_LABELS: Record<string, string> = {
  quickads: 'Quick Ads',
  reviewvideo: 'Review Video',
  conversionvideo: 'Conversion Video',
};

const OVERLAY_STYLE_COLORS: Record<string, string> = {
  headline: 'bg-primary/20 text-primary border-primary/30',
  price: 'bg-warning/20 text-warning border-warning/30',
  badge: 'bg-info/20 text-info border-info/30',
  cta: 'bg-destructive/20 text-destructive border-destructive/30',
};

const RENDER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Đang chờ', color: 'bg-warning/20 text-warning' },
  queued: { label: 'Đang chờ', color: 'bg-warning/20 text-warning' },
  processing: { label: 'Đang render', color: 'bg-info/20 text-info' },
  completed: { label: 'Hoàn thành', color: 'bg-primary/20 text-primary' },
  failed: { label: 'Thất bại', color: 'bg-destructive/20 text-destructive' },
  cancelled: { label: 'Đã huỷ', color: 'bg-muted text-muted-foreground' },
};

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-7 px-2">
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {label || (copied ? 'Đã copy' : 'Copy')}
    </Button>
  );
}

const ScriptRender = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useSettings();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  /** Có thay đổi chưa lưu trong tab Cảnh. */
  const [scenesDirty, setScenesDirty] = useState(false);
  const [savingScenes, setSavingScenes] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [script, setScript] = useState<any>(null);
  const [visualPack, setVisualPack] = useState<any>(null);
  const [captions, setCaptions] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const hasAutoTriggered = useRef(false);

  // Render state
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [latestRender, setLatestRender] = useState<RenderJob | null>(null);
  const [renderHistory, setRenderHistory] = useState<RenderJob[]>([]);

  // Preview state
  const [previewAspect, setPreviewAspect] = useState<'9:16' | '16:9' | '1:1'>('9:16');

  /**
   * Tuỳ chọn lúc dựng.
   *
   * Trước 30/10 hai ô "Không chèn chữ" và "Cắt viền ảnh" chỉ có ở bước tạo dự án, và
   * trang này gửi `rawInput` KHÔNG mang chúng — nên khách tick xong rồi dựng lại từ
   * đây thì chúng biến mất. Đo trên CSDL: không một render nào từng mang hai cờ đó.
   *
   * Đặt ngay cạnh nút Render thì khách thấy mình đang chọn gì cho đúng lần dựng này.
   */
  const [giongDoc, setGiongDoc] = useState<'nu' | 'nam'>('nu');
  const [khongChenChu, setKhongChenChu] = useState(false);
  const [catVienAnh, setCatVienAnh] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(true);

  /**
   * @param imLang Nạp lại mà KHÔNG lật trang về trạng thái đang tải.
   *
   * Vòng lặp theo dõi render gọi hàm này mỗi 3 giây. Với `setLoading(true)` mỗi lần,
   * cả trang biến mất rồi hiện lại ba giây một — đó chính là hiện tượng màn hình chớp
   * giật trong lúc render. Lần nạp ĐẦU vẫn cần skeleton; các lần nạp nền thì không.
   */
  const loadData = useCallback(async (imLang = false) => {
    if (!projectId) return;
    if (!imLang) setLoading(true);
    setError(null);
    try {
      const [projRes, scriptRes, vpRes, capRes, renderRes] = await Promise.all([
        ProjectService.getById(projectId),
        ScriptService.getByProject(projectId),
        ScriptService.getVisualPack(projectId),
        ScriptService.getCaptions(projectId),
        RenderService.getByProject(projectId),
      ]);
      if (projRes.error || !projRes.project) {
        setError('Không tìm thấy dự án');
        return;
      }
      setProject(projRes.project);
      setScript(scriptRes.script);
      setVisualPack(vpRes.visualPack);
      setCaptions(capRes.captions);
      setRenderHistory(renderRes.renders);
      setLatestRender(renderRes.renders[0] || null);

      if (projRes.project.status === 'conceptready' && !scriptRes.script && !hasAutoTriggered.current) {
        hasAutoTriggered.current = true;
        // Truyền thẳng dự án vừa đọc được, KHÔNG trông vào state `project`.
        handleGenerate(projRes.project);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  /**
   * @param duAn Dự án để lấy `package_type`. PHẢI truyền vào khi gọi ngay sau
   *   `setProject(...)`: React cập nhật state bất đồng bộ, nên biến `project` lúc đó
   *   vẫn còn `null` và `project.package_type` ném lỗi. Đó chính là lỗi ngày 29/10 —
   *   `loadData` tự gọi hàm này khi dự án ở trạng thái `conceptready` và chưa có
   *   script, tức đúng lúc `project` chưa kịp cập nhật.
   */
  async function handleGenerate(duAn?: any) {
    if (!projectId) return;
    setGenerating(true);
    setError(null);
    try {
      const nguon = duAn ?? project;
      // Ensure package_type is sent without underscores for backend API
      const apiPackageType = (nguon?.package_type || 'quick_ads').replace('_', '');
      const res = await ScriptService.generate(projectId, apiPackageType);
      
      if (res.error && !res.jobId) {
        setError(res.error);
        toast({ title: 'Lỗi tạo script', description: res.error, variant: 'destructive' });
        return;
      }

      if (res.jobId) {
        let attempts = 0;
        const maxAttempts = 60; // 120 seconds
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;
          
          const jobStatus = await ScriptService.pollJobStatus(res.jobId);
          if (jobStatus.status === 'completed') {
            toast({ title: 'Script đã tạo xong!' });
            await loadData();
            return;
          } else if (jobStatus.status === 'failed') {
            setError(jobStatus.error || 'Lỗi khi tạo script');
            toast({ title: 'Lỗi tạo script', description: jobStatus.error || 'AI xử lý thất bại', variant: 'destructive' });
            return;
          }
        }
        
        setError('Hệ thống bị quá tải. Vui lòng tải lại trang.');
        toast({ title: 'Timeout', description: 'Quá thời gian chờ AI', variant: 'destructive' });
      } else {
        toast({ title: 'Script đã tạo xong!' });
        await loadData();
      }
    } catch {
      setError('Có lỗi xảy ra khi tạo script');
    } finally {
      // `generating` PHẢI gỡ ở đây, không rải ở từng nhánh.
      //
      // Bản cũ gọi setGenerating(false) ở bốn chỗ — và cả bốn đều là ĐƯỜNG LỖI. Hai
      // đường thành công `return` thẳng sau `await loadData()` mà không gỡ cờ, nên
      // script tạo xong, dữ liệu nạp về, mà trang vẫn quay vòng mãi.
      //
      // Backend không hề có lỗi: log VPS ghi `[AI] Completed script-composer` sau 22
      // giây. Người bán nhìn vòng xoay rồi tải lại trang, và dự án đứng lại ở trạng
      // thái dở dang — đúng cơ chế đã sinh ra 36 dự án treo.
      //
      // Cùng một lỗi với cờ `uploading` ở wizard tạo dự án.
      setGenerating(false);
    }
  }

  /**
   * Sửa một trường của một cảnh.
   *
   * Ghi thẳng vào `script` trong bộ nhớ để ô nhập phản hồi ngay, và bật cờ `dirty` để
   * nút Lưu hiện ra. KHÔNG tự lưu mỗi lần gõ: mỗi phím là một lượt ghi cơ sở dữ liệu,
   * và người bán đang sửa dở một câu thì chưa muốn nó thành thật.
   */
  function suaCanh(idx: number, truong: 'overlay_text' | 'voice_line', giaTri: string) {
    setScript((truoc: any) => {
      if (!truoc) return truoc;
      const the = Array.isArray(truoc.scene_cards) ? [...truoc.scene_cards] : [];
      if (!the[idx]) return truoc;
      the[idx] = { ...the[idx], [truong]: giaTri };
      return { ...truoc, scene_cards: the };
    });
    setScenesDirty(true);
  }

  async function handleSaveScenes() {
    if (!projectId || !script) return;
    setSavingScenes(true);
    try {
      const the = Array.isArray(script.scene_cards) ? script.scene_cards : [];
      const { error } = await ScriptService.updateSceneCards(projectId, the);
      if (error) {
        toast({ title: 'Không lưu được', description: error, variant: 'destructive' });
        return;
      }
      setScenesDirty(false);
      toast({ title: 'Đã lưu kịch bản', description: 'Video sẽ dựng đúng nội dung này.' });
    } catch (e: any) {
      toast({ title: 'Không lưu được', description: e?.message ?? 'Lỗi không rõ', variant: 'destructive' });
    } finally {
      setSavingScenes(false);
    }
  }

  async function handleRender(mode: 'draft_local' | 'draftlocaltts' = 'draft_local') {
    if (!projectId || !script) return;

    // LOCALONLYMODE enforcement: block premiumcloud on client side
    if (mode === 'premiumcloud' as string && settings.LOCALONLYMODE) {
      toast({ title: 'Chế độ local-only', description: 'Không thể dùng cloud render khi LOCALONLYMODE=true.', variant: 'destructive' });
      return;
    }

    setRendering(true);
    setRenderProgress(0);

    try {
      // Gửi kịch bản dưới dạng SCENE GRAPH, không phải rawInput.
      //
      // `createJob(projectId, mode, script)` đặt `script` vào vị trí tham số thứ ba là
      // `rawInput`. Worker thấy `raw_input` thì chạy TRỌN chuỗi 4 tầng và **viết lại
      // kịch bản từ đầu** — kịch bản hiện trên trang không phải kịch bản được dựng.
      //
      // Đó là gốc rễ của "không kiểm soát được kịch bản": sửa gì trên trang này cũng
      // bị bỏ qua, và mỗi lần bấm Render lại ra một nội dung khác.
      //
      // Truyền qua `sceneGraph` thì worker dùng `sceneCardsToSceneGraph` và BỎ QUA
      // tầng 1–3, dựng đúng thứ người bán đang nhìn.
      // Ảnh sản phẩm PHẢI đi kèm.
      //
      // Bản cũ gửi `image_urls: []` viết cứng — đúng dòng này. Worker nhận kế hoạch
      // dựng có sáu cảnh nhưng không một ảnh nào, và ffmpeg sập với
      // `3221225477` (ACCESS_VIOLATION). Đo thật ngày 29/10: render hỏng có
      // `raw_input.image_urls: 0 ảnh`, render chạy được có 3.
      //
      // Chú thích ngay trên dòng đó còn ghi "rawInput chỉ còn mang ảnh và tỉ lệ" —
      // ý định đúng, nhưng mảng để rỗng.
      /**
       * Đọc ảnh để gửi kèm — nhưng KHÔNG chặn khi đọc không được.
       *
       * Bản trước của tôi chặn cứng ở đây: `imageUrls.length === 0` thì báo "Chưa có
       * ảnh sản phẩm" và dừng. Đó là sai, vì worker VỐN tự truy `project_assets` khi
       * `image_urls` rỗng (xem `resolveRealImageUrls`), và nó còn ném lỗi rõ ràng
       * `NO_PRODUCT_IMAGES` khi dự án thật sự không có ảnh.
       *
       * Hậu quả của việc chặn: một lần đọc Supabase hỏng — mạng chớp, khoá phiên bận
       * — biến thành "không render được", và không có một yêu cầu nào tới backend để
       * lần ra nguyên nhân. Gửi kèm ảnh là tối ưu, không phải điều kiện.
       */
      let imageUrls: string[] = [];
      try {
        const { assets, error: loiAnh } = await AssetService.getByProject(projectId);
        imageUrls = assetUrls(assets ?? []);
        if (loiAnh) console.warn('[Render] Doc anh that bai, de worker tu tra:', loiAnh);
      } catch (e: any) {
        console.warn('[Render] Doc anh nem loi, de worker tu tra:', e?.message ?? e);
      }

      if (imageUrls.length === 0) {
        console.warn('[Render] Khong doc duoc URL anh o frontend — worker se tu truy CSDL.');
      }

      const res = await RenderService.createJob(
        projectId,
        mode,
        // rawInput chỉ còn mang ảnh và tỉ lệ; nội dung do scene graph quyết.
        {
          image_urls: imageUrls,
          aspect_ratio: '9:16',
          product_title: project?.title ?? '',
          // Giọng đọc khách chọn. Backend nhận cả mã đầy đủ lẫn 'nu'/'nam'.
          voice: giongDoc,
          // Hai tuỳ chọn làm sạch — trước đây bị bỏ rơi ở chính dòng này.
          // Gia tinh theo DON KHACH DAT. Thieu dong nay thi backend lui ve 20 giay.
          duration_seconds: giayKichBan,
          no_text_overlay: khongChenChu || undefined,
          crop_edges: catVienAnh ? 0.08 : undefined,
        },
        '9:16',
        { scene_cards: Array.isArray(script.scene_cards) ? script.scene_cards : [] },
      );
      if (res.error) {
        throw new Error(res.error);
      }

      toast({ title: 'Đã gửi lệnh Render', description: 'Hệ thống (Worker) đang xử lý video của bạn trong nền.' });
      
      // 2. We don't render locally anymore, we just wait for the worker to finish
      // The UI will update via Realtime or regular polling in a real app,
      // here we just trigger loadData periodically or let the user click Refresh.
      
      // Polling loop for demo purposes (every 3s for max 2 minutes)
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;

        // Hỏi trạng thái TRƯỚC, rồi mới nạp lại — và nạp im lặng.
        //
        // Bản cũ gọi `loadData()` (5 lời gọi mạng, kèm bật cờ loading) rồi gọi THÊM
        // `getLatest` nữa: sáu lượt mạng mỗi 3 giây, và cả trang nhấp nháy theo.
        const { render } = await RenderService.getLatest(projectId);
        await loadData(true);
        
        if (render) {
          if (render.status === 'processing' || render.status === 'pending') {
            // Fake progress just to show it's working
            // Dùng tiến độ THẬT từ worker, không tự bịa.
            //
            // Bản cũ cộng +5 mỗi lần hỏi (3 giây một lần), nên sau 3 vòng nó đứng ở
            // 15% trong khi worker đã chạy tới 99%. Người bán nhìn con số đó và kết
            // luận hệ thống treo, rồi tải lại trang hoặc bấm render lần nữa.
            //
            // Chỉ cho số TĂNG: worker ghi tiến độ theo từng chặng, và một lần hỏi lỡ
            // nhịp trả về số cũ sẽ làm thanh tiến độ tụt ngược.
            const that = Number((render as any).progress);
            setRenderProgress((prev) =>
              Number.isFinite(that) && that > 0
                ? Math.max(prev, Math.min(that, 99))
                : Math.min(prev + 5, 95)
            );
          } else if (render.status === 'completed' || render.status === 'failed' || render.status === 'retryable_failed') {
            clearInterval(pollInterval);
            setRendering(false);
            setRenderProgress(100);
            if (render.status === 'completed') {
              toast({ title: 'Render hoàn tất!', description: 'Video của bạn đã sẵn sàng.' });
            } else {
              toast({ title: 'Render thất bại', description: render.error_message || 'Có lỗi xảy ra', variant: 'destructive' });
            }
          }
        }
        
        if (attempts > 40) { // 2 mins max
          clearInterval(pollInterval);
          setRendering(false);
        }
      }, 3000);

    } catch (err: any) {
      toast({ title: 'Lỗi gửi lệnh render', description: err.message, variant: 'destructive' });
      setRendering(false);
    }
  }

  if (loading) return <LoadingState message="Đang tải script workspace..." />;
  if (error && !script) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <ErrorState
          title="Không thể tải script"
          message={error}
          onRetry={project?.status === 'conceptready' ? () => handleGenerate(project) : loadData}
        />
      </div>
    );
  }

  if (generating) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Đang tạo script...</h3>
              <p className="text-sm text-muted-foreground">AI đang viết script, scene cards, overlays và caption</p>
              <Badge variant="outline" className="mt-2">{PACKAGE_LABELS[project?.package_type] || project?.package_type}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!script) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Chưa có script</h3>
              <p className="text-sm text-muted-foreground">Hãy chọn concept trước khi tạo script</p>
            </div>
            <Button onClick={() => navigate(`/projects/${projectId}/concepts`)} className="mt-2">
              Chọn Concept <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sceneCards = Array.isArray(script.scene_cards) ? script.scene_cards : [];

  /**
   * Thoi luong THAT cua kich ban dang hien tren trang, va gia theo no.
   *
   * Trang nay khong cho doi thoi luong: kich ban da duoc viet theo mot do dai cu the,
   * doi so giay ma khong viet lai loi thoai thi chi ra mot video cung noi dung bi keo
   * hoac bi cat. Muon do dai khac thi sinh lai kich ban tu dau.
   *
   * Nhung PHAI gui dung con so nay xuong backend. Khong gui thi `specFromRequest` lui
   * ve mac dinh 20 giay, va kich ban 40 giay bi tinh gia cua video 20 giay — bao mot
   * dang, tru mot dang.
   */
  const giayKichBan = Number(script.duration_sec) > 0
    ? Number(script.duration_sec)
    : sceneCards.reduce((t: number, c: any) => t + (Number(c?.duration_sec) || 0), 0) || 20;
  const giaCredit = creditsFor({ durationSec: giayKichBan });
  const overlayList = visualPack?.overlay_list && Array.isArray(visualPack.overlay_list) ? visualPack.overlay_list : [];
  const showPremium = settings.PREMIUMRENDERENABLED && !settings.LOCALONLYMODE;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Script Workspace</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline">{PACKAGE_LABELS[script.package_type] || script.package_type}</Badge>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {script.duration_sec}s
            </span>
            <span className="text-sm text-muted-foreground">{sceneCards.length} scenes</span>
            <span className="text-sm text-muted-foreground">{overlayList.length} overlays</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${projectId}/concepts`)} className="gap-1.5">
            <ChevronLeft className="h-3.5 w-3.5" /> Concepts
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleGenerate(project)} disabled={generating || rendering} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Tạo lại
          </Button>
        </div>
      </div>

      {/* Split pane: left=content, right=preview+render */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* ========== LEFT PANEL: Content ========== */}
        <div className="space-y-0">
          <Tabs defaultValue="script" className="w-full">
            <TabsList className="bg-secondary/50 w-full justify-start overflow-x-auto">
              <TabsTrigger value="script" className="gap-1.5 text-xs"><FileText className="h-3 w-3" /> Script</TabsTrigger>
              <TabsTrigger value="scenes" className="gap-1.5 text-xs"><Layers className="h-3 w-3" /> Scenes</TabsTrigger>
              <TabsTrigger value="overlays" className="gap-1.5 text-xs"><Type className="h-3 w-3" /> Overlays</TabsTrigger>
              <TabsTrigger value="captions" className="gap-1.5 text-xs"><MessageSquare className="h-3 w-3" /> Captions</TabsTrigger>
            </TabsList>

            {/* Script tab */}
            <TabsContent value="script" className="space-y-4 mt-4">
              <Card className="border-border bg-card">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Script Text
                  </CardTitle>
                  <CopyButton text={script.script_text || ''} />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{script.script_text}</p>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Play className="h-4 w-4 text-primary" /> CTA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-primary font-semibold">{script.cta}</p>
                </CardContent>
              </Card>

              {visualPack?.subtitle_text && (
                <Card className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Type className="h-4 w-4 text-primary" /> Subtitle / Phụ đề
                    </CardTitle>
                    <CopyButton text={visualPack.subtitle_text} />
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{visualPack.subtitle_text}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Scenes tab */}
            {/*
              Tab Cảnh là chỗ KIỂM SOÁT, không phải chỗ xem.

              Người bán sửa câu chữ trên màn hình và lời đọc của từng cảnh, lưu lại,
              rồi bấm Render — worker đọc thẳng `scene_cards` này và BỎ QUA tầng 1–3,
              nên thứ họ sửa đúng là thứ được dựng.

              Trước đây tab này chỉ hiển thị: kịch bản hiện trên trang không phải kịch
              bản được dựng, vì render gửi cả script vào `rawInput` và worker viết lại
              từ đầu. Mỗi lần bấm Render ra một nội dung khác.
            */}
            <TabsContent value="scenes" className="space-y-3 mt-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  Sửa trực tiếp câu chữ và lời đọc. Video sẽ dựng đúng nội dung bạn để ở đây.
                </p>
                {scenesDirty && (
                  <Button size="sm" onClick={handleSaveScenes} disabled={savingScenes}>
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {savingScenes ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </Button>
                )}
              </div>

              {sceneCards.map((scene: any, idx: number) => (
                <Card key={idx} className="border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {scene.scene_no || idx + 1}
                      </div>
                      <div className="flex-1 space-y-3 min-w-0">
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" /> {scene.duration_sec}s
                        </Badge>

                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            Chữ trên màn hình
                            <span className="ml-1.5 normal-case tracking-normal opacity-70">
                              — ngắn, 3–6 từ; để trống nếu cảnh này không cần chữ
                            </span>
                          </label>
                          <Input
                            value={scene.overlay_text ?? ''}
                            onChange={(e) => suaCanh(idx, 'overlay_text', e.target.value)}
                            placeholder="(không có chữ)"
                            className="h-8 text-sm"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            Lời đọc
                          </label>
                          <Textarea
                            value={scene.voice_line ?? ''}
                            onChange={(e) => suaCanh(idx, 'voice_line', e.target.value)}
                            placeholder="(cảnh này không có lời)"
                            rows={2}
                            className="text-sm resize-none"
                          />
                        </div>

                        {scene.visual_instruction && (
                          <p className="text-[11px] text-muted-foreground">
                            <span className="uppercase tracking-wide">Hình ảnh:</span>{' '}
                            {scene.visual_instruction}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Overlays tab */}
            <TabsContent value="overlays" className="space-y-3 mt-4">
              {overlayList.length === 0 ? (
                <Card className="border-border bg-card">
                  <CardContent className="py-8 text-center text-muted-foreground text-sm">Không có overlay nào</CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {overlayList.map((overlay: any, idx: number) => (
                    <Card key={idx} className="border-border bg-card">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <Badge className={`text-xs border ${OVERLAY_STYLE_COLORS[overlay.style] || 'bg-secondary text-secondary-foreground'}`}>
                            {overlay.style}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{overlay.start_sec}s – {overlay.end_sec}s</span>
                        </div>
                        <p className="text-sm font-medium text-foreground">{overlay.text}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Captions tab */}
            <TabsContent value="captions" className="space-y-4 mt-4">
              {captions ? (
                <>
                  <Card className="border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="text-sm">TikTok Caption</CardTitle>
                      <CopyButton text={captions.caption_tiktok || ''} />
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground/90">{captions.caption_tiktok}</p>
                    </CardContent>
                  </Card>

                  <Card className="border-border bg-card">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="text-sm">Instagram Reels Caption</CardTitle>
                      <CopyButton text={captions.caption_reels || ''} />
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground/90">{captions.caption_reels}</p>
                    </CardContent>
                  </Card>

                  {captions.hashtags && Array.isArray(captions.hashtags) && captions.hashtags.length > 0 && (
                    <Card className="border-border bg-card">
                      <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Hash className="h-4 w-4 text-primary" /> Hashtags
                        </CardTitle>
                        <CopyButton text={captions.hashtags.map((h: string) => `#${h}`).join(' ')} />
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1.5">
                          {captions.hashtags.map((tag: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">#{tag}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {captions.thumbnail_text && (
                    <Card className="border-border bg-card">
                      <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Image className="h-4 w-4 text-primary" /> Thumbnail Text
                        </CardTitle>
                        <CopyButton text={captions.thumbnail_text} />
                      </CardHeader>
                      <CardContent>
                        <p className="text-base font-bold text-primary">{captions.thumbnail_text}</p>
                      </CardContent>
                    </Card>
                  )}

                  {captions.short_description && (
                    <Card className="border-border bg-card">
                      <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-sm">Mô tả ngắn</CardTitle>
                        <CopyButton text={captions.short_description} />
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-foreground/80">{captions.short_description}</p>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card className="border-border bg-card">
                  <CardContent className="py-8 text-center text-muted-foreground text-sm">
                    Chưa có caption. Tạo script để tự động sinh caption.
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* ========== RIGHT PANEL: Preview + Render ========== */}
        <div className="space-y-4">
          {/* Video Preview Placeholder */}
          <Card className="border-border bg-card overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" /> Preview
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowSafeZone(!showSafeZone)} className={`h-7 px-2 text-xs ${showSafeZone ? 'bg-secondary' : ''}`}>
                    {showSafeZone ? 'Hide Safe Zone' : 'Show Safe Zone'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              <Tabs value={previewAspect} onValueChange={(v) => setPreviewAspect(v as any)} className="w-full mb-3">
                <TabsList className="grid w-full grid-cols-3 h-8">
                  <TabsTrigger value="9:16" className="text-xs">9:16</TabsTrigger>
                  <TabsTrigger value="16:9" className="text-xs">16:9</TabsTrigger>
                  <TabsTrigger value="1:1" className="text-xs">1:1</TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="w-full max-w-[280px] mx-auto">
                <div className={`relative rounded-lg overflow-hidden bg-background border border-border flex flex-col items-center justify-center 
                  ${previewAspect === '9:16' ? 'aspect-[9/16]' : previewAspect === '16:9' ? 'aspect-video w-full' : 'aspect-square'} transition-all duration-300`}>
                  
                  {/* Safe Zone Overlays */}
                  {showSafeZone && (
                     <div className="absolute inset-0 z-10 pointer-events-none p-4">
                       <div className="w-full h-full border-2 border-dashed border-red-500/50 flex items-center justify-center">
                         <span className="bg-background/80 text-foreground px-2 py-1 rounded text-[10px] opacity-50">Safe Zone</span>
                       </div>
                     </div>
                  )}

                  {latestRender?.status === 'completed' && latestRender.output_url ? (
                    <video
                      src={latestRender.output_url}
                      poster={latestRender.thumbnail_url ?? undefined}
                      preload="metadata"
                      controls
                      playsInline
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  ) : (
                    <div className="relative z-0 flex flex-col items-center justify-center gap-3 bg-muted/50 w-full h-full">
                      <Monitor className="h-10 w-10 text-muted-foreground/40" />
                      <div className="text-center px-4">
                        <p className="text-sm font-medium text-muted-foreground">Preview {previewAspect}</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Render video để xem kết quả</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Render Controls */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Film className="h-4 w-4 text-primary" /> Render
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rendering ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-foreground">Đang render...</span>
                    <span className="text-xs text-muted-foreground ml-auto">{renderProgress}%</span>
                  </div>
                  <Progress value={renderProgress} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground">
                    {renderProgress < 5 ? 'Khởi tạo...' :
                     renderProgress < 85 ? 'Composing scenes + overlays...' :
                     renderProgress < 95 ? 'Uploading...' : 'Hoàn tất...'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Tuỳ chọn NẰM CẠNH nút dựng, không ở một bước trước đó.
                      Trước 30/10 hai ô làm sạch chỉ có ở bước tạo dự án và bị trang
                      này bỏ rơi — khách tick xong thì chúng biến mất không dấu vết. */}
                  <div className="rounded-lg border border-border bg-muted/30 p-2.5 space-y-2.5">
                    <div>
                      <div className="text-[11px] font-medium text-foreground mb-1.5">Giọng đọc</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {([['nu', 'Giọng nữ'], ['nam', 'Giọng nam']] as const).map(([ma, ten]) => (
                          <button
                            key={ma}
                            type="button"
                            onClick={() => setGiongDoc(ma)}
                            className={cn(
                              'rounded-md border px-2 py-1.5 text-[11px] transition-all',
                              giongDoc === ma
                                ? 'border-primary bg-primary/10 text-foreground font-medium'
                                : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                            )}
                          >
                            {ten}
                          </button>
                        ))}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Chỉ áp dụng cho bản có lồng tiếng.
                      </div>
                    </div>

                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={khongChenChu}
                        onChange={(e) => setKhongChenChu(e.target.checked)}
                        className="mt-0.5 accent-primary"
                      />
                      <span className="text-[11px] leading-tight">
                        <span className="text-foreground">Không chèn chữ lên video</span>
                        <span className="block text-muted-foreground">
                          Bỏ cả tiêu đề lẫn phụ đề, để tự gõ caption trong TikTok.
                        </span>
                      </span>
                    </label>

                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={catVienAnh}
                        onChange={(e) => setCatVienAnh(e.target.checked)}
                        className="mt-0.5 accent-primary"
                      />
                      <span className="text-[11px] leading-tight">
                        <span className="text-foreground">Cắt viền ảnh để bỏ logo góc</span>
                        <span className="block text-muted-foreground">
                          Cắt 8% quanh mép — ảnh có sản phẩm sát mép thì đừng bật.
                        </span>
                      </span>
                    </label>
                  </div>

                  <Button onClick={() => handleRender('draft_local')} className="gap-2 w-full" size="sm" disabled={rendering}>
                    <Film className="h-3.5 w-3.5" /> Render Draft {khongChenChu ? '' : '+ phụ đề'}
                    <span className="ml-auto text-[11px] opacity-80">{giaCredit} credit</span>
                  </Button>
                  {/* Mở lại 28/10: lồng tiếng chạy thật qua FPT, và worker chỉ sinh giọng
                      cho đúng chế độ draft_local_tts nên bản này không còn trùng bản Draft. */}
                  <Button
                    onClick={() => handleRender('draftlocaltts')}
                    variant="secondary"
                    disabled={rendering}
                    className="gap-2 w-full"
                    size="sm"
                  >
                    <Play className="h-3.5 w-3.5" /> Draft + Giọng đọc
                    <span className="ml-auto text-[11px] opacity-80">{giaCredit} credit</span>
                  </Button>
                  {showPremium && (
                    <Button variant="outline" disabled className="gap-2 w-full" size="sm" title="Coming soon">
                      <Video className="h-3.5 w-3.5" /> Premium Cloud
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Render Status */}
          {latestRender && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Trạng thái</CardTitle>
                  <Badge className={`text-[10px] ${RENDER_STATUS_MAP[latestRender.status]?.color || ''}`}>
                    {RENDER_STATUS_MAP[latestRender.status]?.label || latestRender.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {latestRender.status === 'completed' && latestRender.output_url && (
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm" className="gap-1.5 flex-1">
                      <a href={latestRender.output_url} download target="_blank" rel="noopener noreferrer">
                        <Download className="h-3.5 w-3.5" /> Tải video
                      </a>
                    </Button>
                    <Button onClick={() => handleRender('draft_local')} variant="ghost" size="sm" className="gap-1.5" disabled={rendering}>
                      <RefreshCw className="h-3.5 w-3.5" /> Lại
                    </Button>
                  </div>
                )}

                {latestRender.status === 'failed' && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                      <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-destructive">{latestRender.error_message || 'Render thất bại'}</p>
                        {latestRender.error_code && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">Mã lỗi: {latestRender.error_code}</p>
                        )}
                        {latestRender.last_fail_reason && (
                          <div className="mt-1 p-1 bg-background/50 rounded border border-border/50">
                            <p className="text-[9px] font-mono text-muted-foreground break-all">
                              {latestRender.last_fail_reason}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button onClick={() => handleRender('draft_local')} variant="outline" size="sm" className="gap-1.5 w-full" disabled={rendering}>
                      <RefreshCw className="h-3.5 w-3.5" /> Thử lại (Không tốn credit)
                    </Button>
                  </div>
                )}

                {latestRender.duration_ms && latestRender.status === 'completed' && (
                  <p className="text-[10px] text-muted-foreground">
                    Render time: {(latestRender.duration_ms / 1000).toFixed(1)}s
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Render History */}
          {renderHistory.length > 1 && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Lịch sử ({renderHistory.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {renderHistory.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">{r.render_mode.replace('_', ' ')}</Badge>
                        <Badge className={`text-[10px] ${RENDER_STATUS_MAP[r.status]?.color || ''}`}>
                          {RENDER_STATUS_MAP[r.status]?.label || r.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(r.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                        </span>
                        {r.status === 'completed' && r.output_url && (
                          <Button asChild variant="ghost" size="sm" className="h-5 w-5 p-0">
                            <a href={r.output_url} download target="_blank" rel="noopener noreferrer">
                              <Download className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScriptRender;
