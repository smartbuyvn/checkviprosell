/**
 * Viprosell â€” Script Workspace (Split-pane layout)
 * Left: script text, scene cards, overlays, captions, hashtags, thumbnail
 * Right: preview placeholder, render status, retry, export
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText, Play, Clock, Hash, Image, Type, Copy, Check,
  RefreshCw, Loader2, ChevronRight, ChevronLeft, Video,
  Download, AlertTriangle, Film, Sparkles, Monitor, Eye,
  Layers, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/hooks/useSettings';
import { ScriptService } from '@/services/script.service';
import { ProjectService } from '@/services/project.service';
import { RenderService, type RenderJob } from '@/services/render.service';
import { AssetService } from '@/services/asset.service';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';

const PACKAGE_LABELS: Record<string, string> = {
  quick_ads: 'Quick Ads',
  review_video: 'Review Video',
  conversion_video: 'Conversion Video',
};

const OVERLAY_STYLE_COLORS: Record<string, string> = {
  headline: 'bg-primary/20 text-primary border-primary/30',
  price: 'bg-warning/20 text-warning border-warning/30',
  badge: 'bg-info/20 text-info border-info/30',
  cta: 'bg-destructive/20 text-destructive border-destructive/30',
};

const RENDER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  queued: { label: 'Äang chá»', color: 'bg-warning/20 text-warning' },
  processing: { label: 'Äang render', color: 'bg-info/20 text-info' },
  completed: { label: 'HoÃ n thÃ nh', color: 'bg-primary/20 text-primary' },
  failed: { label: 'Tháº¥t báº¡i', color: 'bg-destructive/20 text-destructive' },
  cancelled: { label: 'ÄÃ£ huá»·', color: 'bg-muted text-muted-foreground' },
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
      {label || (copied ? 'ÄÃ£ copy' : 'Copy')}
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

  // Preview State
  const [previewAspect, setPreviewAspect] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [showSafeZone, setShowSafeZone] = useState(true);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
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
        setError('KhÃ´ng tÃ¬m tháº¥y dá»± Ã¡n');
        return;
      }
      setProject(projRes.project);
      setScript(scriptRes.script);
      setVisualPack(vpRes.visualPack);
      setCaptions(capRes.captions);
      setRenderHistory(renderRes.renders);
      setLatestRender(renderRes.renders[0] || null);

      if (projRes.project.status === 'concept_ready' && !scriptRes.script && !hasAutoTriggered.current) {
        hasAutoTriggered.current = true;
        handleGenerate();
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleGenerate() {
    if (!projectId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await ScriptService.generate(projectId);
      if (res.error) {
        setError(res.error);
        toast({ title: 'Lá»—i táº¡o script', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Script Ä‘Ã£ táº¡o xong!' });
      await loadData();
    } catch {
      setError('CÃ³ lá»—i xáº£y ra khi táº¡o script');
    } finally {
      setGenerating(false);
    }
  }

  async function handleRender(mode: 'draft_local' | 'draft_local_tts' = 'draft_local') {
    if (!projectId || !script) return;

    // LOCAL_ONLY_MODE enforcement: block premium_cloud on client side
    if (mode === 'premium_cloud' as string && settings.LOCAL_ONLY_MODE) {
      toast({ title: 'Cháº¿ Ä‘á»™ local-only', description: 'KhÃ´ng thá»ƒ dÃ¹ng cloud render khi LOCAL_ONLY_MODE=true.', variant: 'destructive' });
      return;
    }

    setRendering(true);
    setRenderProgress(0);

    try {
      const { assets: projectAssets } = await AssetService.getByProject(projectId);
      // Include both images and videos â€” prioritise videos for richer output
      const assetEntries = projectAssets
        .filter((a: any) => a.asset_type === 'image' || a.asset_type === 'video')
        .sort((a: any, b: any) => {
          // Videos first, then by sort_order
          if (a.asset_type === 'video' && b.asset_type !== 'video') return -1;
          if (a.asset_type !== 'video' && b.asset_type === 'video') return 1;
          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        })
        .map((a: any) => ({ url: a.file_url, type: a.asset_type as 'image' | 'video' }));

      const sceneCards = Array.isArray(script.scene_cards) ? script.scene_cards : [];
      const overlayList = visualPack?.overlay_list && Array.isArray(visualPack.overlay_list)
        ? visualPack.overlay_list : [];

      const result = await RenderService.executeLocalRender(
        projectId,
        mode,
        {
          width: 1080, height: 1920, fps: 15,
          scenes: sceneCards, overlays: overlayList,
          subtitleText: visualPack?.subtitle_text || '',
          ctaText: script.cta || 'Mua ngay!',
          assets: assetEntries,
          productName: project?.title || 'Viprosell',
          ttsMode: mode === 'draft_local_tts' ? 'local' : 'none',
        },
        (pct) => setRenderProgress(pct),
      );

      if (!result.success) {
        // Explicit fail messaging when local fails and cloud fallback is off
        const fallbackMsg = !settings.CLOUD_FALLBACK_ENABLED
          ? ' Cloud fallback Ä‘ang táº¯t â€” chá»‰ cÃ³ thá»ƒ retry local.'
          : '';
        toast({ title: 'Render tháº¥t báº¡i', description: (result.error || 'Lá»—i khÃ´ng xÃ¡c Ä‘á»‹nh') + fallbackMsg, variant: 'destructive' });
      } else {
        toast({ title: 'Video Ä‘Ã£ render xong!' });
      }
      await loadData();
    } catch (err: any) {
      toast({ title: 'Lá»—i render', description: err.message, variant: 'destructive' });
    } finally {
      setRendering(false);
      setRenderProgress(0);
    }
  }

  if (loading) return <LoadingState message="Äang táº£i script workspace..." />;
  if (error && !script) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <ErrorState
          title="KhÃ´ng thá»ƒ táº£i script"
          message={error}
          onRetry={project?.status === 'concept_ready' ? handleGenerate : loadData}
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
              <h3 className="text-lg font-semibold text-foreground">Äang táº¡o script...</h3>
              <p className="text-sm text-muted-foreground">AI Ä‘ang viáº¿t script, scene cards, overlays vÃ  caption</p>
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
              <h3 className="text-lg font-semibold text-foreground">ChÆ°a cÃ³ script</h3>
              <p className="text-sm text-muted-foreground">HÃ£y chá»n concept trÆ°á»›c khi táº¡o script</p>
            </div>
            <Button onClick={() => navigate(`/projects/${projectId}/concepts`)} className="mt-2">
              Chá»n Concept <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sceneCards = Array.isArray(script.scene_cards) ? script.scene_cards : [];
  const overlayList = visualPack?.overlay_list && Array.isArray(visualPack.overlay_list) ? visualPack.overlay_list : [];
  const showPremium = settings.PREMIUM_RENDER_ENABLED && !settings.LOCAL_ONLY_MODE;

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
          <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating || rendering} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Táº¡o láº¡i
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
                      <Type className="h-4 w-4 text-primary" /> Subtitle / Phá»¥ Ä‘á»
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
            <TabsContent value="scenes" className="space-y-3 mt-4">
              {sceneCards.map((scene: any, idx: number) => (
                <Card key={idx} className="border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {scene.scene_no || idx + 1}
                      </div>
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" /> {scene.duration_sec}s
                          </Badge>
                          {scene.overlay_text && (
                            <Badge className="text-xs bg-accent/20 text-accent-foreground border-accent/30">
                              {scene.overlay_text}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">HÃ¬nh áº£nh</span>
                            <p className="text-sm text-foreground/90">{scene.visual_instruction}</p>
                          </div>
                          {scene.voice_line && (
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Lá»i nÃ³i</span>
                              <p className="text-sm text-foreground/80 italic">"{scene.voice_line}"</p>
                            </div>
                          )}
                        </div>
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
                  <CardContent className="py-8 text-center text-muted-foreground text-sm">KhÃ´ng cÃ³ overlay nÃ o</CardContent>
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
                          <span className="text-xs text-muted-foreground">{overlay.start_sec}s â€“ {overlay.end_sec}s</span>
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
                        <CardTitle className="text-sm">MÃ´ táº£ ngáº¯n</CardTitle>
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
                    ChÆ°a cÃ³ caption. Táº¡o script Ä‘á»ƒ tá»± Ä‘á»™ng sinh caption.
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
                      controls
                      playsInline
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  ) : (
                    <div className="relative z-0 flex flex-col items-center justify-center gap-3 bg-muted/50 w-full h-full">
                      <Monitor className="h-10 w-10 text-muted-foreground/40" />
                      <div className="text-center px-4">
                        <p className="text-sm font-medium text-muted-foreground">Preview {previewAspect}</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Render video Ä‘á»ƒ xem káº¿t quáº£</p>
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
                    <span className="text-sm text-foreground">Äang render...</span>
                    <span className="text-xs text-muted-foreground ml-auto">{renderProgress}%</span>
                  </div>
                  <Progress value={renderProgress} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground">
                    {renderProgress < 5 ? 'Khá»Ÿi táº¡o...' :
                     renderProgress < 85 ? 'Composing scenes + overlays...' :
                     renderProgress < 95 ? 'Uploading...' : 'HoÃ n táº¥t...'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button onClick={() => handleRender('draft_local')} className="gap-2 w-full" size="sm">
                    <Film className="h-3.5 w-3.5" /> Render Draft
                  </Button>
                  <Button onClick={() => handleRender('draft_local_tts')} variant="secondary" className="gap-2 w-full" size="sm">
                    <Play className="h-3.5 w-3.5" /> Draft + Voice
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
                  <CardTitle className="text-sm">Tráº¡ng thÃ¡i</CardTitle>
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
                        <Download className="h-3.5 w-3.5" /> Táº£i video
                      </a>
                    </Button>
                    <Button onClick={() => handleRender('draft_local')} variant="ghost" size="sm" className="gap-1.5" disabled={rendering}>
                      <RefreshCw className="h-3.5 w-3.5" /> Láº¡i
                    </Button>
                  </div>
                )}

                {latestRender.status === 'failed' && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                      <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-destructive">{latestRender.error_message || 'Render tháº¥t báº¡i'}</p>
                        {latestRender.error_code && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">MÃ£ lá»—i: {latestRender.error_code}</p>
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
                      <RefreshCw className="h-3.5 w-3.5" /> Thá»­ láº¡i (KhÃ´ng tá»‘n credit)
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
                <CardTitle className="text-sm">Lá»‹ch sá»­ ({renderHistory.length})</CardTitle>
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
