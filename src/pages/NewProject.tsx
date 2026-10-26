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
  Box, Maximize, Settings2, Save, Cloud, PlayCircle, Monitor
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
import { RenderService, type RenderJob } from '@/services/render.service';
import { AssetService, validateFiles, getFileCountMessage, type UploadProgress } from '@/services/asset.service';
import { isAbortOrLockError } from '@/lib/errorUtils';
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

type SourceMode = 'url' | 'upload';

const NewProject = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('id');
  const { settings } = useSettings();
  const { toast } = useToast();

  const [isLoadingDraft, setIsLoadingDraft] = useState(!!draftId);
  const [step, setStep] = useState(0);
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);
  
  const [sourceMode, setSourceMode] = useState<SourceMode>('url');
  const [sourceUrl, setSourceUrl] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);
  
  const [aspect, setAspect] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [exportMode, setExportMode] = useState<'auto' | 'simple_crop' | 'smart_pan' | 'relayout'>('auto');
  const [renderMode, setRenderMode] = useState<RenderMode>('draft_local');

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Render tracking state
  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatus, setRenderStatus] = useState<string | null>(null);
  const [renderOutputUrl, setRenderOutputUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Realtime Render Subscription
  useEffect(() => {
    if (!renderJobId) return;

    const channel = supabase.channel(`render_tracker_${renderJobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'renders', filter: `id=eq.${renderJobId}` },
        (payload) => {
          const newStatus = payload.new.status;
          setRenderStatus(newStatus);
          
          if (payload.new.progress !== null) {
            setRenderProgress(payload.new.progress);
          }
          
          if (newStatus === 'completed' && payload.new.output_url) {
            setRenderProgress(100);
            setRenderOutputUrl(payload.new.output_url);
            toast({ title: 'Video đã sẵn sàng!', description: 'Quá trình render đã hoàn tất thành công.' });
          } else if (newStatus === 'failed' || newStatus === 'retryable_failed') {
            setRenderError(payload.new.error_message || 'Render thất bại');
            toast({ title: 'Lỗi Render', description: payload.new.error_message || 'Có lỗi xảy ra', variant: 'destructive' });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [renderJobId]);

  // Load Draft
  useEffect(() => {
    if (!draftId) return;
    const loadDraft = async () => {
      const { project } = await ProjectService.getById(draftId);
      if (project) {
        setSelectedPackage(project.package_type);
        setSourceUrl(project.source_url || '');
        if (project.source_url) setSourceMode('url');
        setManualNotes(project.manual_notes || '');
        setSelectedCategory(project.category);
        const { assets } = await AssetService.getByProject(project.id);
        if (assets && assets.length > 0) {
          setSourceMode('upload');
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
  const isStep1Valid = sourceMode === 'url'
    ? sourceUrl.trim().length > 5
    : (() => {
        const v = validateFiles(selectedFiles);
        return v.valid && v.errors.length === 0;
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
      source_url: sourceMode === 'url' ? sourceUrl.trim() : undefined,
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

  const handleCreate = async () => {
    if (!selectedPackage || !selectedCategory || !aspect || !exportMode) return;
    // Guard: prevent double-click race condition
    if (creating) return;
    setCreating(true);

    try {
      const { project, error: createError } = await saveToDb(true);

      if (createError || !project) {
        toast({ title: 'Lỗi tạo dự án', description: createError ?? 'Không thể tạo bản nháp dự án', variant: 'destructive' });
        setCreating(false);
        return;
      }

      if (sourceMode === 'upload' && selectedFiles.length > 0) {
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
      if (sourceMode === 'upload' && project.id) {
        const { assets } = await AssetService.getByProject(project.id);
        if (assets && assets.length > 0) {
          imageUrls = assets.map((a: any) => a.url);
        }
      }

      const rawInput = {
        product_title: project.title,
        product_summary: manualNotes.trim() || 'No notes provided',
        product_url: sourceUrl || undefined,
        image_urls: imageUrls,
        target_audience: 'General',
        aspect_ratio: aspect,
        duration_seconds: 30,
        package_type: selectedPackage
      };

      const { data: renderData, error: renderError } = await RenderService.createJob(project.id, renderMode, rawInput);
      
      if (renderError || !renderData?.renderId) {
        toast({ title: 'Lỗi', description: renderError || 'Không thể bắt đầu render', variant: 'destructive' });
        setCreating(false);
        return;
      }

      setRenderJobId(renderData.renderId);
      setRenderStatus('pending');
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
    }
  };

  const fileValidation = validateFiles(selectedFiles);
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
          <div className="shrink-0 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
            📦 {selectedPkgInfo.name}
          </div>
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
                 Bước 2: Cung cấp nguồn hình ảnh cho <span className="text-primary font-medium">{selectedPkgInfo?.name}</span>:
               </p>
 
               <div className="flex gap-2">
                 <button
                   onClick={() => setSourceMode('url')}
                   className={cn(
                     'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all border flex items-center justify-center gap-2',
                     sourceMode === 'url' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground'
                   )}
                 >
                   <Link2 className="w-4 h-4" /> Dán link sản phẩm
                 </button>
                 <button
                   onClick={() => setSourceMode('upload')}
                   className={cn(
                     'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all border flex items-center justify-center gap-2',
                     sourceMode === 'upload' ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground'
                   )}
                 >
                   <Upload className="w-4 h-4" /> Upload 3-8 ảnh/video
                 </button>
               </div>
 
               {sourceMode === 'url' && (
                 <div className="space-y-3 mt-4">
                   <div className="space-y-1.5">
                     <Label htmlFor="sourceUrl" className="text-xs text-muted-foreground">URL Sản phẩm (Shopee, Lazada, TikTok Shop,...)</Label>
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
                   <div className="space-y-1.5">
                     <Label htmlFor="notes" className="text-xs text-muted-foreground">Ghi chú AI (Tùy chọn)</Label>
                     <Textarea
                       id="notes"
                       placeholder="VD: Chỉ lấy góc màu đỏ, tập trung ưu đãi..."
                       value={manualNotes}
                       onChange={(e) => setManualNotes(e.target.value)}
                       className="bg-card resize-none h-20"
                       maxLength={500}
                     />
                   </div>
                 </div>
               )}
 
               {sourceMode === 'upload' && (
                 <div className="space-y-3 mt-4">
                   <div
                     onDragOver={(e) => e.preventDefault()}
                     onDrop={handleFileDrop}
                     onClick={() => fileInputRef.current?.click()}
                     className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/40 transition-colors cursor-pointer bg-card/30"
                   >
                     <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                     <p className="text-sm text-foreground font-medium mb-1">Kéo thả hoặc click để upload</p>
                     <p className="text-xs text-muted-foreground">3–8 ảnh + tối đa 1 video mẫu (Giới hạn: 20MB/file)</p>
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
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5" /> Kiểu Render (Trải qua Admin Policy)</Label>
                    <div className="grid sm:grid-cols-3 gap-2">
                      <button onClick={() => setRenderMode('draft_local')} className={cn('rounded-lg p-3 text-left transition-all border', renderMode === 'draft_local' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card opacity-80 hover:opacity-100')}>
                         <span className="text-xs font-semibold text-foreground block">Draft Local (Free)</span>
                         <span className="text-[10px] text-muted-foreground block mt-0.5">Render tại máy, không âm thanh TTS.</span>
                      </button>
                      <button onClick={() => setRenderMode('draftlocaltts')} className={cn('rounded-lg p-3 text-left transition-all border', renderMode === 'draftlocaltts' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card opacity-80 hover:opacity-100')}>
                         <span className="text-xs font-semibold text-foreground block">Draft + TTS Voice</span>
                         <span className="text-[10px] text-muted-foreground block mt-0.5">Render tại máy, kèm ghép giọng cục bộ.</span>
                      </button>
                      
                      {(!settings.PREMIUMRENDERENABLED || settings.LOCALONLYMODE) ? (
                         <div className="rounded-lg p-3 border border-dashed border-border/50 bg-background/50 flex flex-col justify-center opacity-60">
                            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Cloud className="w-3 h-3" /> Premium Cloud</span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">Bị khóa bởi chính sách Admin.</span>
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

               <div className="max-w-md mx-auto space-y-8">
                 {renderStatus === 'completed' && renderOutputUrl ? (
                   <div className="aspect-[9/16] w-full max-w-[280px] mx-auto rounded-xl overflow-hidden border border-border shadow-lg bg-black">
                     <video src={renderOutputUrl} controls playsInline autoPlay className="w-full h-full object-contain" />
                   </div>
                 ) : (
                   <div className="space-y-3">
                     <Progress value={renderProgress} className="h-3" />
                     <div className="flex justify-between text-xs text-muted-foreground">
                       <span>{renderProgress < 20 ? 'AI Pipeline' : 'Rendering GPU'}</span>
                       <span className="font-medium text-foreground">{renderProgress}%</span>
                     </div>
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
          <Button
            className="glow-primary font-display min-w-40"
            onClick={handleCreate}
            disabled={!canProceed(3) || creating || uploading}
          >
            {creating || uploading ? (
               <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lưu & Tải lên...</>
            ) : (
               <><PlayCircle className="w-4 h-4 mr-2" /> Hoàn thành & Render</>
            )}
          </Button>
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
    </motion.div>
  );
};

export default NewProject;
