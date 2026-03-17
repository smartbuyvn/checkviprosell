/**
 * Viprosell — New Project Wizard
 * 4-step guided project creation with real validation and upload.
 */

import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, Link2, Upload, Image, ArrowRight, ArrowLeft,
  Sparkles, CheckCircle2, Mic, Cloud, Monitor, X, AlertCircle,
  FileImage, FileVideo, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { PACKAGES, PACKAGE_LIST } from '@/constants/packages';
import { ROUTES, buildRoute } from '@/constants/routes';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';
import { ProjectService } from '@/services/project.service';
import { AssetService, validateFiles, getFileCountMessage, type UploadProgress } from '@/services/asset.service';
import type { PackageType, ProductCategory } from '@/types';
import { cn } from '@/lib/utils';

const CATEGORIES: { id: ProductCategory; label: string; emoji: string; desc: string }[] = [
  { id: 'beauty', label: 'Mỹ phẩm & Skincare', emoji: '💄', desc: 'Son, kem, serum, mask...' },
  { id: 'fashion', label: 'Thời trang', emoji: '👗', desc: 'Áo, quần, phụ kiện...' },
  { id: 'home', label: 'Đồ gia dụng', emoji: '🏠', desc: 'Nhà bếp, đồ dùng, trang trí...' },
  { id: 'other', label: 'Khác', emoji: '📦', desc: 'Điện tử, food, health...' },
];

type SourceMode = 'url' | 'upload';

const NewProject = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { toast } = useToast();

  // Wizard state
  const [step, setStep] = useState(0);
  const [selectedPackage, setSelectedPackage] = useState<PackageType | null>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode>('url');
  const [sourceUrl, setSourceUrl] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);
  const [aspect, setAspect] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [exportMode, setExportMode] = useState<'auto' | 'simple_crop' | 'smart_pan' | 'relayout'>('auto');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const steps = ['Gói Video', 'Nguồn SP', 'Tỉ lệ', 'Export Mode'];

  // Validation per step
  const isStep0Valid = selectedPackage !== null;
  const isStep1Valid = sourceMode === 'url'
    ? sourceUrl.trim().length > 5
    : (() => {
        const v = validateFiles(selectedFiles);
        return v.valid && v.errors.length === 0;
      })();
  const isStep2Valid = aspect !== null;

  const canProceed = (s: number) => {
    switch (s) {
      case 0: return isStep0Valid;
      case 1: return isStep1Valid;
      case 2: return isStep2Valid;
      default: return true;
    }
  };

  // File handling
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
    // Still add valid files
    const validFiles = [...validation.images.slice(0, 8), ...validation.videos.slice(0, 1)];
    setSelectedFiles(validFiles);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Generate title from URL or package
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

  // Create project
  const handleCreate = async () => {
    if (!selectedPackage || !aspect || !exportMode) return;
    setCreating(true);

    try {
      // 1. Create draft project
      const { project, error: createError } = await ProjectService.create({
        title: generateTitle(),
        package_type: selectedPackage,
        category: selectedCategory ?? ('other' as ProductCategory),
        source_url: sourceMode === 'url' ? sourceUrl.trim() : undefined,
        manual_notes: manualNotes.trim() || undefined,
        // @ts-ignore
        aspect,
        // @ts-ignore
        export_mode: exportMode,
      });

      if (createError || !project) {
        toast({ title: 'Lỗi tạo dự án', description: createError ?? 'Không thể tạo dự án', variant: 'destructive' });
        setCreating(false);
        return;
      }

      // 2. Upload assets if any
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
        }
        setUploading(false);
      }

      // 3. Navigate to project analysis screen
      toast({ title: 'Dự án đã tạo!', description: `${project.title} sẵn sàng phân tích.` });
      navigate(buildRoute(ROUTES.PROJECT_ANALYSIS, { projectId: project.id }));
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message ?? 'Đã xảy ra lỗi', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const fileValidation = validateFiles(selectedFiles);
  const selectedPkgInfo = selectedPackage ? PACKAGES[selectedPackage] : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
      {/* Header with package badge */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Tạo dự án mới</h1>
          <p className="text-sm text-muted-foreground">Hoàn thành {steps.length} bước để bắt đầu tạo video.</p>
        </div>
        {selectedPkgInfo && step > 0 && (
          <div className="shrink-0 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
            📦 {selectedPkgInfo.name}
          </div>
        )}
      </div>

      {/* Progress */}
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

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

          {/* ===== STEP 0: Package selection ===== */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Chọn loại video bạn muốn tạo:</p>
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
                    <div className="flex flex-wrap gap-1 mt-2">
                      {pkg.priority.map((p) => (
                        <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{p}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===== STEP 1: Source input ===== */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cung cấp nguồn sản phẩm cho <span className="text-primary font-medium">{selectedPkgInfo?.name}</span>:
              </p>

              {/* Mode toggle */}
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
                  <Upload className="w-4 h-4" /> Upload ảnh/video
                </button>
              </div>

              {/* URL mode */}
              {sourceMode === 'url' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sourceUrl" className="text-xs text-muted-foreground">URL sản phẩm</Label>
                    <Input
                      id="sourceUrl"
                      placeholder="https://shopee.vn/... hoặc bất kỳ URL sản phẩm"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      className="bg-card"
                    />
                    <p className="text-xs text-muted-foreground">Hỗ trợ: Shopee, Tiki, Lazada, TikTok Shop, hoặc bất kỳ link sản phẩm.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-xs text-muted-foreground">Ghi chú (tùy chọn)</Label>
                    <Textarea
                      id="notes"
                      placeholder="VD: Tập trung vào tính năng chống nắng, target nữ 20-30..."
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      className="bg-card resize-none h-20"
                      maxLength={500}
                    />
                  </div>
                </div>
              )}

              {/* Upload mode */}
              {sourceMode === 'upload' && (
                <div className="space-y-3">
                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/40 transition-colors cursor-pointer bg-card/30"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-foreground font-medium mb-1">Kéo thả hoặc click để chọn file</p>
                    <p className="text-xs text-muted-foreground">3–8 ảnh (JPG, PNG, WebP) + tùy chọn 1 video (MP4)</p>
                    <p className="text-xs text-muted-foreground mt-1">Tối đa 20MB mỗi file</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={[...AssetService.ACCEPTED_IMAGE_TYPES, ...AssetService.ACCEPTED_VIDEO_TYPES].join(',')}
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {/* File previews */}
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-foreground">
                          {getFileCountMessage(fileValidation.images, fileValidation.videos)}
                        </p>
                        {selectedFiles.length < 3 && sourceMode === 'upload' && (
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
                              <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                                <FileVideo className="w-5 h-5 text-primary" />
                                <span className="text-[9px] text-muted-foreground truncate px-1">{file.name}</span>
                              </div>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                              className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {/* Add more placeholder */}
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

                  {/* Validation errors */}
                  {fileValidation.errors.length > 0 && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-1">
                      {fileValidation.errors.map((err, i) => (
                        <p key={i} className="text-xs text-destructive flex items-start gap-1.5">
                          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                          {err.file ? `${err.file}: ${err.message}` : err.message}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <Label htmlFor="uploadNotes" className="text-xs text-muted-foreground">Ghi chú (tùy chọn)</Label>
                    <Textarea
                      id="uploadNotes"
                      placeholder="VD: Ảnh 1-3 là mặt trước, ảnh 4 là đang sử dụng..."
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      className="bg-card resize-none h-20"
                      maxLength={500}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== STEP 2: Aspect ===== */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Chọn tỉ lệ khung hình (Aspect Ratio):</p>
              <div className="grid grid-cols-3 gap-3">
                {['9:16', '16:9', '1:1'].map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspect(ratio as any)}
                    className={cn(
                      'rounded-xl p-4 text-center transition-all border flex flex-col items-center gap-3',
                      aspect === ratio
                        ? 'border-primary bg-primary/5 shadow-card-hover'
                        : 'border-border bg-card shadow-card hover:shadow-card-hover'
                    )}
                  >
                    <div className={cn(
                      'border-2 border-current rounded',
                      ratio === '9:16' ? 'w-6 h-10' : ratio === '16:9' ? 'w-10 h-6' : 'w-8 h-8'
                    )} />
                    <div>
                      <h3 className="font-display text-sm font-semibold text-foreground">{ratio}</h3>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {ratio === '9:16' ? 'Miễn phí (TikTok/Reels)' : '+20% chi phí'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===== STEP 3: Export Mode & Summary & Create ===== */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Chọn chế độ Export và xác nhận tạo dự án:</p>

              {/* Export Mode */}
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { id: 'auto', name: 'Auto', desc: 'Hệ thống tự quyết định' },
                  { id: 'simple_crop', name: 'Simple Crop (Quick Ads)', desc: 'Scale & Crop nhanh' },
                  { id: 'smart_pan', name: 'Smart Pan (Review)', desc: 'Giữ focus chủ thể' },
                  { id: 'relayout', name: 'Relayout (Conversion)', desc: 'Tái cấu trúc UI theo aspect' }
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setExportMode(mode.id as any)}
                    className={cn(
                      'rounded-xl p-3 text-left transition-all border flex flex-col',
                      exportMode === mode.id
                        ? 'border-primary bg-primary/5 shadow-card-hover'
                        : 'border-border bg-card shadow-card hover:shadow-card-hover'
                    )}
                  >
                    <h3 className="font-display text-sm font-semibold text-foreground">{mode.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{mode.desc}</p>
                  </button>
                ))}
              </div>

              {/* Summary */}
              <div className="rounded-xl p-5 bg-card border border-border space-y-3 mt-4">
                <h4 className="font-display text-sm font-semibold text-foreground">Tóm tắt dự án</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                     <span className="text-muted-foreground">Gói video</span>
                     <span className="text-foreground font-medium">{selectedPkgInfo?.name}</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-muted-foreground">Tỉ lệ</span>
                     <span className="text-foreground font-medium">{aspect}</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-muted-foreground">Chế độ Export</span>
                     <span className="text-foreground font-medium">{exportMode}</span>
                  </div>
                  <div className="flex justify-between">
                     <span className="text-muted-foreground">Nguồn</span>
                     <span className="text-foreground font-medium truncate max-w-[200px]">
                       {sourceMode === 'url' ? (sourceUrl || '—') : getFileCountMessage(fileValidation.images, fileValidation.videos)}
                     </span>
                  </div>
                </div>
              </div>

               {/* Upload progress */}
               {uploading && uploadProgress.length > 0 && (
                 <div className="rounded-xl p-4 bg-card border border-border space-y-2">
                   <p className="text-xs font-medium text-foreground flex items-center gap-2">
                     <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Đang upload...
                   </p>
                   {uploadProgress.map((p, i) => (
                     <div key={i} className="flex items-center gap-2">
                       <span className="text-xs text-muted-foreground truncate flex-1">{p.fileName}</span>
                       {p.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                       {p.status === 'uploading' && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />}
                       {p.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                       {p.status === 'pending' && <span className="w-3.5 h-3.5 rounded-full bg-muted shrink-0" />}
                     </div>
                   ))}
                 </div>
               )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="flex justify-between pt-2">
        <Button
          variant="outline"
          onClick={() => step === 0 ? navigate(ROUTES.DASHBOARD) : setStep(step - 1)}
          disabled={creating || uploading}
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> {step === 0 ? 'Dashboard' : 'Quay lại'}
        </Button>
        {step < 3 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed(step)}
          >
            Tiếp tục <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        ) : (
          <Button
            className="glow-primary font-display"
            onClick={handleCreate}
            disabled={creating || uploading}
          >
            {creating ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Đang tạo...</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Tạo dự án</>
            )}
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default NewProject;
