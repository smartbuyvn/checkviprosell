/**
 * Viprosell — Concept Selection Screen
 * Displays 3 AI-generated commerce angles and allows user to pick one.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lightbulb, RefreshCw, AlertTriangle, ChevronRight, ChevronLeft, CheckCircle2, Flame, Heart, Zap, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ConceptService, type Concept } from '@/services/concept.service';
import { ProjectService } from '@/services/project.service';
import { ErrorState } from '@/components/shared/ErrorState';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'loading' | 'success' | 'failed';

const ANGLE_META: Record<string, { label: string; icon: typeof Flame; color: string; description: string }> = {
  painfirst: {
    label: 'Pain First',
    icon: Flame,
    color: 'text-destructive',
    description: 'Đánh vào nỗi đau khách hàng, rồi đưa ra giải pháp',
  },
  reviewvideotrust: {
    label: 'Review Trust',
    icon: Heart,
    color: 'text-primary',
    description: 'Xây dựng niềm tin qua trải nghiệm thực tế',
  },
  offerconversionvideo: {
    label: 'Offer Conversion',
    icon: Zap,
    color: 'text-warning',
    description: 'Tạo urgency với offer, giá, bundle hấp dẫn',
  },
};

const ConceptSelection = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('idle');
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [packageType, setPackageType] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);

  // Load existing data
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const [{ project }, { concepts: existing }] = await Promise.all([
        ProjectService.getById(projectId),
        ConceptService.getByProject(projectId),
      ]);
      if (project) {
        setProjectTitle(project.title);
        setPackageType(project.package_type);
      }
      if (existing.length > 0) {
        setConcepts(existing);
        const sel = existing.find((c) => c.is_selected);
        if (sel) setSelectedId(sel.id);
        setStatus('success');
      }
    })();
  }, [projectId]);

  const generateConcepts = useCallback(async () => {
    if (!projectId) return;
    try {
      setStatus('loading');
      setErrorMsg(null);
      setErrorDetails([]);

      const result = await ConceptService.generate(projectId);

      if (result.error) {
        setStatus('failed');
        setErrorMsg(result.error);
        setErrorDetails(result.details || []);
        toast.error(result.error);
        return;
      }

      if (result.jobId) {
        let attempts = 0;
        const maxAttempts = 45; // 90 seconds (45 * 2s)

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;

          // 1. Check if data is ready in DB
          const { concepts: existing } = await ConceptService.getByProject(projectId);
          if (existing && existing.length > 0) {
            setConcepts(existing);
            const sel = existing.find((c) => c.is_selected);
            if (sel) setSelectedId(sel.id);
            else setSelectedId(null);
            setStatus('success');
            toast.success('Đã sinh 3 concept bán hàng!');
            return;
          }

          // 2. Check job status for failure
          const jobStatus = await ConceptService.pollJobStatus(result.jobId);
          if (jobStatus.status === 'failed') {
            setStatus('failed');
            setErrorMsg(jobStatus.error || 'AI Worker xử lý thất bại');
            toast.error('AI Worker xử lý thất bại');
            return;
          }
        }

        setStatus('failed');
        setErrorMsg('Hệ thống bị quá tải hoặc phản hồi chậm (Timeout). Vui lòng tải lại trang hoặc thử lại sau.');
        toast.error('Quá thời gian chờ AI xử lý');
      } else if (result.concepts && result.concepts.length > 0) {
        setConcepts(result.concepts);
        setSelectedId(null);
        setStatus('success');
        toast.success('Đã sinh 3 concept bán hàng!');
      }
    } catch (e: any) {
      // Lưới an toàn cuối cùng: trang này không có try/catch nào khác.
      //
      // Một lỗi bất ngờ ở bất kỳ đâu trong luồng bất đồng bộ sẽ để `status` kẹt ở
      // 'loading' vĩnh viễn — người bán chỉ thấy vòng xoay, không thông báo, không nút
      // thử lại, và dự án nằm lại ở trạng thái dở dang. Đó là cơ chế đã sinh ra 36 dự
      // án treo trong cơ sở dữ liệu.
      setStatus('failed');
      setErrorMsg(e?.message || 'Có lỗi không mong đợi. Tải lại trang rồi thử lại.');
    }
  }, [projectId]);

  // Auto-generate if no concepts exist (guard against re-mount)
  const hasAutoTriggered = useRef(false);
  useEffect(() => {
    if (status === 'idle' && concepts.length === 0 && projectId && !hasAutoTriggered.current) {
      hasAutoTriggered.current = true;
      generateConcepts();
    }
  }, [status, concepts.length, projectId, generateConcepts]);

  const handleSelect = async (conceptId: string) => {
    if (!projectId || selecting) return;
    setSelecting(true);
    try {
      const { error } = await ConceptService.select(projectId, conceptId);
      if (error) {
        toast.error('Không thể chọn concept');
      } else {
        setSelectedId(conceptId);
        setConcepts((prev) => prev.map((c) => ({ ...c, is_selected: c.id === conceptId })));
        toast.success('Đã chọn concept!');
      }
    } catch {
      toast.error('Không thể chọn concept — thử lại giúp tôi');
    } finally {
      // Thiếu `finally` thì một lỗi bất ngờ khoá nút chọn vĩnh viễn, và người bán
      // không đi tiếp được bước nào.
      setSelecting(false);
    }
  };

  if (!projectId) return <ErrorState message="Thiếu project ID" />;

  // Loading
  if (status === 'loading') {
    return (
      <div className="max-w-4xl mx-auto py-12 space-y-6">
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center space-y-4">
            <div className="animate-spin mx-auto w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
            <h2 className="text-xl font-semibold text-foreground">Đang sinh concept bán hàng...</h2>
            <p className="text-muted-foreground text-sm">AI đang tạo 3 góc tiếp cận thương mại khác nhau cho sản phẩm của bạn</p>
            <Progress value={55} className="max-w-xs mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Failed
  if (status === 'failed') {
    return (
      <div className="max-w-4xl mx-auto py-12 space-y-6">
        <Card className="border-destructive/50 bg-card">
          <CardContent className="py-12 text-center space-y-4">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="text-xl font-semibold text-foreground">Sinh concept thất bại</h2>
            <p className="text-muted-foreground">{errorMsg}</p>
            {errorDetails.length > 0 && (
              <div className="text-left max-w-md mx-auto bg-muted rounded-lg p-3 text-sm text-muted-foreground">
                <p className="font-medium mb-1">Chi tiết lỗi:</p>
                <ul className="list-disc pl-4 space-y-1">
                  {errorDetails.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
            <Button onClick={generateConcepts} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" /> Thử lại
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success — show 3 concept cards
  if (status === 'success' && concepts.length > 0) {
    const sorted = [...concepts].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const bestId = sorted[0]?.id;

    return (
      <div className="max-w-5xl mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chọn concept bán hàng</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {projectTitle} — <span className="capitalize">{packageType?.replace('_', ' ')}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}/analysis`)} className="gap-2">
              <ChevronLeft className="h-4 w-4" /> Quay lại
            </Button>
            <Button variant="ghost" size="sm" onClick={generateConcepts} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Sinh lại
            </Button>
            {selectedId && (
              <Button onClick={() => navigate(`/projects/${projectId}/script`)} className="gap-2">
                Tiếp tục <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Concept cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {sorted.map((concept) => {
            const meta = ANGLE_META[concept.angle_type] || ANGLE_META.painfirst;
            const Icon = meta.icon;
            const isSelected = concept.id === selectedId;
            const isBest = concept.id === bestId;

            return (
              <Card
                key={concept.id}
                className={cn(
                  'border-border bg-card relative cursor-pointer transition-all hover:shadow-md',
                  isSelected && 'ring-2 ring-primary border-primary',
                )}
                onClick={() => handleSelect(concept.id)}
              >
                {/* Best badge */}
                {isBest && (
                  <div className="absolute -top-2.5 left-4">
                    <Badge className="bg-primary text-primary-foreground text-xs gap-1">
                      <Star className="h-3 w-3" /> Điểm cao nhất
                    </Badge>
                  </div>
                )}

                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  </div>
                )}

                <CardHeader className="pb-3 pt-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn('h-5 w-5', meta.color)} />
                    <Badge variant="outline" className="text-xs">{meta.label}</Badge>
                    <span className="ml-auto text-sm font-bold text-foreground">{concept.score ?? 0}/100</span>
                  </div>
                  <CardTitle className="text-base leading-snug">{concept.title}</CardTitle>
                  <CardDescription className="text-xs mt-1">{meta.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 text-sm">
                  {/* Big idea */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Big Idea</p>
                    <p className="text-foreground">{concept.big_idea}</p>
                  </div>

                  {/* Hook */}
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Hook (3s đầu)</p>
                    <p className="text-foreground font-medium italic">"{concept.hook}"</p>
                  </div>

                  {/* CTA */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">CTA</p>
                    <p className="text-foreground">{concept.cta}</p>
                  </div>

                  {/* Why it works */}
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Tại sao hiệu quả</p>
                    <p className="text-muted-foreground text-xs">{concept.why_it_works}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {!selectedId && (
          <p className="text-center text-muted-foreground text-sm">
            Nhấn vào card để chọn concept bạn muốn sử dụng
          </p>
        )}
      </div>
    );
  }

  // Idle fallback
  return (
    <div className="max-w-3xl mx-auto py-12 space-y-6">
      <Card className="border-border bg-card">
        <CardContent className="py-12 text-center space-y-4">
          <Lightbulb className="mx-auto h-12 w-12 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Concept bán hàng</h2>
          <p className="text-muted-foreground">AI sẽ tạo 3 góc tiếp cận thương mại khác nhau cho video của bạn.</p>
          <Button onClick={generateConcepts} className="gap-2">
            <Lightbulb className="h-4 w-4" /> Sinh concept
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConceptSelection;
