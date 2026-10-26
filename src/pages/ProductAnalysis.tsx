/**
 * Viprosell — Product Analysis Page
 * Triggers AI product intelligence, displays results with inline editing.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search, RefreshCw, AlertTriangle, ChevronRight, Sparkles, Target,
  ShieldCheck, MessageSquareWarning, Package, Lightbulb,
  Pencil, Check, X, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { IntelService, type IntelResult } from '@/services/intel.service';
import { ProjectService } from '@/services/project.service';
import { ErrorState } from '@/components/shared/ErrorState';

type Status = 'idle' | 'loading' | 'success' | 'failed';

type ArrayField = 'usp_list' | 'pain_points' | 'objections' | 'trust_signals' | 'use_context' | 'recommended_package_fit';

const SECTION_CONFIG: { key: ArrayField; label: string; icon: typeof Sparkles; color: string }[] = [
  { key: 'usp_list', label: 'USP / Điểm mạnh', icon: Sparkles, color: 'text-primary' },
  { key: 'pain_points', label: 'Pain Points', icon: Target, color: 'text-warning' },
  { key: 'objections', label: 'Objections', icon: MessageSquareWarning, color: 'text-destructive' },
  { key: 'trust_signals', label: 'Trust Signals', icon: ShieldCheck, color: 'text-info' },
  { key: 'use_context', label: 'Use Context', icon: Lightbulb, color: 'text-warning' },
];

const ProductAnalysis = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('idle');
  const [intel, setIntel] = useState<IntelResult | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectStatus, setProjectStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load existing data
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const [{ project }, { intel: existing }] = await Promise.all([
        ProjectService.getById(projectId),
        IntelService.getByProject(projectId),
      ]);
      if (project) {
        setProjectTitle(project.title);
        setProjectStatus(project.status);
      }
      if (existing && existing.confidence_score && existing.confidence_score > 0) {
        setIntel({
          product_name: existing.product_name || '',
          category: existing.category || 'other',
          target_buyer: existing.target_buyer || '',
          price_band: existing.price_band || 'mid',
          usp_list: (existing.usp_list as string[]) || [],
          pain_points: (existing.pain_points as string[]) || [],
          objections: (existing.objections as string[]) || [],
          trust_signals: (existing.trust_signals as string[]) || [],
          use_context: (existing.use_context as string[]) || [],
          recommended_package_fit: (existing.recommended_package_fit as string[]) || [],
          confidence_score: existing.confidence_score || 0,
        });
        setStatus('success');
      }
    })();
  }, [projectId]);

  const runAnalysis = useCallback(async () => {
    if (!projectId) return;
    setStatus('loading');
    setErrorMsg(null);
    setErrorDetails([]);
    setDirty(false);

    const result = await IntelService.analyze(projectId);

    if (result.error) {
      setStatus('failed');
      setErrorMsg(result.error);
      setErrorDetails((result as any).details || []);
      toast.error(result.error);
      return;
    }

    if (result.jobId) {
      let attempts = 0;
      const maxAttempts = 30; // 60 seconds (30 * 2s)

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;

        // 1. Check if data is ready in DB
        const { intel: existing } = await IntelService.getByProject(projectId);
        if (existing && existing.confidence_score && existing.confidence_score > 0) {
          setIntel({
            product_name: existing.product_name || '',
            category: existing.category || 'other',
            target_buyer: existing.target_buyer || '',
            price_band: existing.price_band || 'mid',
            usp_list: (existing.usp_list as string[]) || [],
            pain_points: (existing.pain_points as string[]) || [],
            objections: (existing.objections as string[]) || [],
            trust_signals: (existing.trust_signals as string[]) || [],
            use_context: (existing.use_context as string[]) || [],
            recommended_package_fit: (existing.recommended_package_fit as string[]) || [],
            confidence_score: existing.confidence_score || 0,
          });
          setStatus('success');
          setProjectStatus('ready');
          toast.success('Phân tích sản phẩm hoàn tất!');
          return;
        }

        // 2. Check job status for failure or backend error
        const jobStatus = await IntelService.pollJobStatus(result.jobId);
        if (jobStatus.status === 'failed' || jobStatus.status === 'error') {
          setStatus('failed');
          setErrorMsg(jobStatus.error || 'AI Worker xử lý thất bại');
          toast.error(jobStatus.status === 'error' ? 'Lỗi kết nối Backend' : 'AI Worker xử lý thất bại');
          return;
        }
      }

      setStatus('failed');
      setErrorMsg('Hệ thống bị quá tải hoặc phản hồi chậm (Timeout). Vui lòng tải lại trang hoặc thử lại sau.');
      toast.error('Quá thời gian chờ AI xử lý');
    } else if (result.intel) {
      // Fallback for legacy sync backend
      setIntel(result.intel);
      setStatus('success');
      setProjectStatus('ready');
      toast.success('Phân tích sản phẩm hoàn tất!');
    }
  }, [projectId]);

  // Auto-trigger if project is in draft
  const hasAutoTriggered = useRef(false);
  useEffect(() => {
    if (projectStatus === 'draft' && status === 'idle' && projectId && !hasAutoTriggered.current) {
      hasAutoTriggered.current = true;
      runAnalysis();
    }
  }, [projectStatus, status, projectId, runAnalysis]);

  // --- Inline edit handlers ---
  const startEditScalar = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const commitScalarEdit = (field: string) => {
    if (!intel || !editValue.trim()) return;
    setIntel({ ...intel, [field]: editValue.trim() });
    setEditingField(null);
    setEditValue('');
    setDirty(true);
  };

  const editArrayItem = (field: ArrayField, index: number, newValue: string) => {
    if (!intel) return;
    const arr = [...(intel[field] as string[])];
    arr[index] = newValue;
    setIntel({ ...intel, [field]: arr });
    setDirty(true);
  };

  const removeArrayItem = (field: ArrayField, index: number) => {
    if (!intel) return;
    const arr = (intel[field] as string[]).filter((_, i) => i !== index);
    setIntel({ ...intel, [field]: arr });
    setDirty(true);
  };

  const addArrayItem = (field: ArrayField) => {
    if (!intel) return;
    const arr = [...(intel[field] as string[]), ''];
    if (arr.length > 5) return;
    setIntel({ ...intel, [field]: arr });
    setDirty(true);
  };

  const saveEdits = async () => {
    if (!projectId || !intel) return;
    setSaving(true);
    const { error } = await IntelService.updateIntel(projectId, {
      product_name: intel.product_name,
      target_buyer: intel.target_buyer,
      usp_list: intel.usp_list,
      pain_points: intel.pain_points,
      objections: intel.objections,
      trust_signals: intel.trust_signals,
      use_context: intel.use_context,
      recommended_package_fit: intel.recommended_package_fit,
    });
    setSaving(false);
    if (error) {
      toast.error('Lưu thất bại: ' + error);
    } else {
      setDirty(false);
      toast.success('Đã lưu thay đổi');
    }
  };

  if (!projectId) return <ErrorState message="Thiếu project ID" />;

  if (status === 'loading') {
    return (
      <div className="max-w-3xl mx-auto py-12 space-y-6">
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center space-y-4">
            <div className="animate-spin mx-auto w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
            <h2 className="text-xl font-semibold text-foreground">Đang phân tích sản phẩm...</h2>
            <p className="text-muted-foreground text-sm">AI đang trích xuất thông tin thương mại từ dữ liệu sản phẩm của bạn</p>
            <Progress value={45} className="max-w-xs mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="max-w-3xl mx-auto py-12 space-y-6">
        <Card className="border-destructive/50 bg-card">
          <CardContent className="py-12 text-center space-y-4">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="text-xl font-semibold text-foreground">Phân tích thất bại</h2>
            <p className="text-muted-foreground">{errorMsg}</p>
            {errorDetails.length > 0 && (
              <div className="text-left max-w-md mx-auto bg-muted rounded-lg p-3 text-sm text-muted-foreground">
                <p className="font-medium mb-1">Chi tiết lỗi:</p>
                <ul className="list-disc pl-4 space-y-1">
                  {errorDetails.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
            <Button onClick={runAnalysis} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Thử lại
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'success' && intel) {
    return (
      <div className="max-w-4xl mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            {editingField === 'product_name' ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="text-xl font-bold h-auto py-1 bg-card"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') commitScalarEdit('product_name'); if (e.key === 'Escape') cancelEdit(); }}
                />
                <Button size="icon" variant="ghost" onClick={() => commitScalarEdit('product_name')}><Check className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <h1
                className="text-2xl font-bold text-foreground group cursor-pointer flex items-center gap-2"
                onClick={() => startEditScalar('product_name', intel.product_name)}
              >
                {intel.product_name}
                <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            )}
            <p className="text-muted-foreground text-sm truncate">{projectTitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {dirty && (
              <Button variant="outline" size="sm" onClick={saveEdits} disabled={saving} className="gap-2">
                <Save className="h-3.5 w-3.5" /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={runAnalysis} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Phân tích lại
            </Button>
            <Button onClick={() => navigate(`/projects/${projectId}/concepts`)} className="gap-2">
              Tiếp tục <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Danh mục" value={intel.category} />
          <EditableSummaryCard
            label="Đối tượng"
            value={intel.target_buyer}
            editing={editingField === 'target_buyer'}
            editValue={editValue}
            onStartEdit={() => startEditScalar('target_buyer', intel.target_buyer)}
            onEditChange={setEditValue}
            onCommit={() => commitScalarEdit('target_buyer')}
            onCancel={cancelEdit}
          />
          <SummaryCard label="Phân khúc giá" value={intel.price_band} />
          <SummaryCard label="Độ tin cậy" value={`${Math.round(intel.confidence_score <= 1 ? intel.confidence_score * 100 : intel.confidence_score)}%`} />
        </div>

        {/* Recommended packages editable field */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
               <CardTitle className="text-base flex items-center gap-2">
                 <Package className="h-4 w-4 text-primary" /> Gói video phù hợp
               </CardTitle>
               {(intel.recommended_package_fit as string[]).length < 3 && (
                 <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => addArrayItem('recommended_package_fit')}>
                   + Thêm
                 </Button>
               )}
            </div>
          </CardHeader>
          <CardContent>
             <ul className="space-y-2">
               {(intel.recommended_package_fit as string[]).map((item, i) => (
                 <EditableListItem
                   key={`package_fit-${i}`}
                   value={item}
                   onChange={(v) => editArrayItem('recommended_package_fit', i, v)}
                   onRemove={() => removeArrayItem('recommended_package_fit', i)}
                 />
               ))}
             </ul>
             <p className="text-[10px] text-muted-foreground mt-2">Dùng: quickads, reviewvideo, conversionvideo</p>
          </CardContent>
        </Card>

        <Separator />

        {/* Detail sections with inline edit */}
        <div className="grid md:grid-cols-2 gap-4">
          {SECTION_CONFIG.map(({ key, label, icon: Icon, color }) => (
            <Card key={key} className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${color}`} /> {label}
                  </CardTitle>
                  {(intel[key] as string[]).length < 5 && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => addArrayItem(key)}>
                      + Thêm
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(intel[key] as string[]).map((item, i) => (
                    <EditableListItem
                      key={`${key}-${i}`}
                      value={item}
                      onChange={(v) => editArrayItem(key, i, v)}
                      onRemove={() => removeArrayItem(key, i)}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // idle — show start button
  return (
    <div className="max-w-3xl mx-auto py-12 space-y-6">
      <Card className="border-border bg-card">
        <CardContent className="py-12 text-center space-y-4">
          <Search className="mx-auto h-12 w-12 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Phân tích sản phẩm</h2>
          <p className="text-muted-foreground">AI sẽ phân tích sản phẩm để tìm USP, pain points, và thông tin thương mại.</p>
          <Button onClick={runAnalysis} className="gap-2">
            <Sparkles className="h-4 w-4" /> Bắt đầu phân tích
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="py-4 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-lg font-semibold text-foreground capitalize mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function EditableSummaryCard({
  label, value, editing, editValue, onStartEdit, onEditChange, onCommit, onCancel,
}: {
  label: string; value: string; editing: boolean; editValue: string;
  onStartEdit: () => void; onEditChange: (v: string) => void; onCommit: () => void; onCancel: () => void;
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="py-4 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
        {editing ? (
          <div className="flex items-center gap-1 mt-1 justify-center">
            <Input
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              className="h-7 text-sm text-center bg-muted"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onCancel(); }}
            />
          </div>
        ) : (
          <p
            className="text-lg font-semibold text-foreground capitalize mt-1 cursor-pointer group flex items-center justify-center gap-1"
            onClick={onStartEdit}
          >
            {value}
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function EditableListItem({
  value, onChange, onRemove,
}: {
  value: string; onChange: (v: string) => void; onRemove: () => void;
}) {
  const [editing, setEditing] = useState(!value);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    if (draft.trim()) {
      onChange(draft.trim());
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <li className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-7 text-sm bg-muted flex-1"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        />
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={commit}><Check className="h-3 w-3" /></Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setDraft(value); setEditing(false); }}><X className="h-3 w-3" /></Button>
      </li>
    );
  }

  return (
    <li className="text-sm text-muted-foreground flex items-center gap-2 group">
      <span className="text-primary">•</span>
      <span className="flex-1 cursor-pointer" onClick={() => setEditing(true)}>{value}</span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditing(true)}><Pencil className="h-2.5 w-2.5" /></Button>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={onRemove}><X className="h-2.5 w-2.5" /></Button>
      </div>
    </li>
  );
}

export default ProductAnalysis;
