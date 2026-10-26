/**
 * Viprosell — Admin Control Plane
 * Full policy center: toggles, service URLs, health checks,
 * failed job logs, prompt registry, contradiction validation, audit trail.
 */

import { useState, useEffect, useCallback } from 'react';
import { LoadingState } from '@/components/shared/LoadingState';
import { motion } from 'framer-motion';
import {
  Settings, AlertTriangle, Shield, Wifi, WifiOff, Activity, RefreshCw,
  CheckCircle2, XCircle, Clock, Loader2, FileText, Eye, EyeOff, Hash,
  Zap, AlertCircle, BarChart3, Save, Edit3, ChevronDown, ChevronUp,
  Server, Volume2, Layers, Lock, Unlock,
} from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { validateSettings } from '@/constants/settings';
import { AdminService } from '@/services/admin.service';

// ---------- Policy Tab ----------

function PolicyTab() {
  const { settings, updateSettings, isLoading, refreshSettings } = useSettings();
  const { toast } = useToast();
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showExtended, setShowExtended] = useState(false);
  const [urlDrafts, setUrlDrafts] = useState({
    LOCALLLMURL: '',
    LOCALRENDERWORKERURL: '',
    LOCAL_TTS_URL: '',
  });
  const [urlDirty, setUrlDirty] = useState(false);

  useEffect(() => {
    setErrors(validateSettings(settings));
    setUrlDrafts({
      LOCALLLMURL: settings.LOCALLLMURL,
      LOCALRENDERWORKERURL: settings.LOCALRENDERWORKERURL,
      LOCAL_TTS_URL: settings.LOCAL_TTS_URL,
    });
  }, [settings]);

  async function handleToggle(key: string, value: boolean) {
    setSaving(true);
    try {
      await updateSettings({ [key]: value } as any);
      await refreshSettings();
      toast({ title: 'Đã cập nhật', description: `${key} = ${value}` });
    } catch {
      toast({ title: 'Lỗi cập nhật', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveUrls() {
    setSaving(true);
    try {
      await updateSettings(urlDrafts as any);
      await refreshSettings();
      setUrlDirty(false);
      toast({ title: 'URLs đã lưu' });
    } catch {
      toast({ title: 'Lỗi lưu URLs', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDefaultChange(key: string, value: any) {
    setSaving(true);
    try {
      await updateSettings({ [key]: value } as any);
      await refreshSettings();
      toast({ title: 'Đã cập nhật', description: `${key} = ${value}` });
    } catch {
      toast({ title: 'Lỗi cập nhật', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function handleUrlDraft(key: string, value: string) {
    setUrlDrafts(prev => ({ ...prev, [key]: value }));
    setUrlDirty(true);
  }

  if (isLoading) return <div className="animate-pulse text-muted-foreground p-4">Đang tải...</div>;

  const coreToggles = [
    {
      key: 'LOCALONLYMODE',
      label: 'Local Only Mode',
      desc: 'Chỉ dùng local services. Tắt tất cả cloud/external APIs.',
      value: settings.LOCALONLYMODE,
      icon: settings.LOCALONLYMODE ? WifiOff : Wifi,
      warn: settings.LOCALONLYMODE,
      info: 'Bật sẽ tự động tắt ALLOWEXTERNALAIAPIS, PREMIUMRENDERENABLED, CLOUDFALLBACKENABLED',
    },
    {
      key: 'ALLOWEXTERNALAIAPIS',
      label: 'Allow External AI APIs',
      desc: 'Cho phép gọi external AI providers (OpenAI, Gemini, etc.)',
      value: settings.ALLOWEXTERNALAIAPIS,
      icon: Zap,
      disabled: settings.LOCALONLYMODE,
    },
    {
      key: 'CLOUDFALLBACKENABLED',
      label: 'Cloud Fallback',
      desc: 'Khi local fail, tự động fallback sang cloud provider.',
      value: settings.CLOUDFALLBACKENABLED,
      icon: Activity,
      disabled: settings.LOCALONLYMODE,
    },
    {
      key: 'PREMIUMRENDERENABLED',
      label: 'Premium Cloud Render',
      desc: 'Cho phép user chọn premium cloud render (tốn thêm credit).',
      value: settings.PREMIUMRENDERENABLED,
      icon: Shield,
      disabled: settings.LOCALONLYMODE,
    },
  ];

  const extendedToggles = [
    {
      key: 'AI_JSON_REPAIR_ENABLED',
      label: 'AI JSON Repair',
      desc: 'Tự động sửa JSON output lỗi từ AI. Tắt sẽ giảm độ bền pipeline.',
      value: settings.AI_JSON_REPAIR_ENABLED,
      icon: Zap,
    },
    {
      key: 'AI_LOG_RAW_OUTPUT',
      label: 'Log Raw AI Output',
      desc: 'Lưu raw AI response vào usage_logs.meta để debug.',
      value: settings.AI_LOG_RAW_OUTPUT,
      icon: FileText,
    },
    {
      key: 'PROMPT_VERSION_PINNING',
      label: 'Prompt Version Pinning',
      desc: 'Ghim phiên bản prompt. Tắt có thể gây prompt drift.',
      value: settings.PROMPT_VERSION_PINNING,
      icon: Lock,
    },
    {
      key: 'TRACE_LOG_ENABLED',
      label: 'Trace Logging',
      desc: 'Ghi trace_id vào tất cả usage_logs cho observability.',
      value: settings.TRACE_LOG_ENABLED,
      icon: Layers,
    },
    {
      key: 'SAFE_MODE_ON_LOCAL_FAILURE',
      label: 'Safe Mode on Local Failure',
      desc: 'Khi local service crash, tự block request thay vì retry vô hạn.',
      value: settings.SAFE_MODE_ON_LOCAL_FAILURE,
      icon: Shield,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Contradiction Warnings */}
      {errors.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">Contradiction Detected ({errors.length})</span>
            </div>
            {errors.map((err, i) => (
              <p key={i} className="text-xs text-destructive/80 pl-6">• {err}</p>
            ))}
            <p className="text-xs text-muted-foreground pl-6 italic">
              Backend sẽ reject các request vi phạm policy — UI hiding không đủ.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Core Policy Toggles */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Core Policy
          </CardTitle>
          <p className="text-xs text-muted-foreground">Enforced server-side qua admin-settings edge function. Mỗi thay đổi ghi audit log.</p>
        </CardHeader>
        <CardContent className="space-y-1">
          {coreToggles.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.key} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${t.warn ? 'bg-warning/5 border border-warning/20' : 'hover:bg-secondary/30'} ${t.disabled ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${t.warn ? 'text-warning' : 'text-muted-foreground'}`} />
                  <div className="min-w-0">
                    <Label className="text-sm text-foreground font-medium">{t.label}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                    {t.disabled && (
                      <p className="text-xs text-warning mt-1 flex items-center gap-1"><Lock className="h-3 w-3" /> Bị khóa bởi LOCALONLYMODE</p>
                    )}
                    {t.info && t.value && (
                      <p className="text-xs text-primary/70 mt-1 italic">{t.info}</p>
                    )}
                  </div>
                </div>
                <Switch
                  checked={t.value}
                  onCheckedChange={(v) => handleToggle(t.key, v)}
                  disabled={saving || !!t.disabled}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Service URLs */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" /> Local Service URLs
          </CardTitle>
          {urlDirty && (
            <Button size="sm" onClick={handleSaveUrls} disabled={saving} className="gap-1.5 text-xs">
              <Save className="h-3 w-3" /> Lưu URLs
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'LOCALLLMURL', label: 'LOCALLLMURL', placeholder: 'http://localhost:11434' },
            { key: 'LOCALRENDERWORKERURL', label: 'LOCALRENDERWORKERURL', placeholder: 'http://localhost:5001' },
            { key: 'LOCAL_TTS_URL', label: 'LOCAL_TTS_URL', placeholder: 'http://localhost:5002' },
          ].map(field => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-mono">{field.label}</Label>
              <Input
                value={(urlDrafts as any)[field.key] || ''}
                onChange={(e) => handleUrlDraft(field.key, e.target.value)}
                className="bg-secondary text-sm font-mono"
                placeholder={field.placeholder}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Editable Defaults */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Defaults</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">DEFAULTTTSMODE</Label>
              <Select value={settings.DEFAULTTTSMODE} onValueChange={(v) => handleDefaultChange('DEFAULTTTSMODE', v)}>
                <SelectTrigger className="bg-secondary text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">local</SelectItem>
                  <SelectItem value="cloud">cloud</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">MAX_ASSETS_PER_PROJECT</Label>
              <Select value={String(settings.MAX_ASSETS_PER_PROJECT)} onValueChange={(v) => handleDefaultChange('MAX_ASSETS_PER_PROJECT', Number(v))}>
                <SelectTrigger className="bg-secondary text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 6, 8, 10, 12, 16].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">DEFAULT_ASPECT_RATIO</Label>
              <Select value={settings.DEFAULT_ASPECT_RATIO} onValueChange={(v) => handleDefaultChange('DEFAULT_ASPECT_RATIO', v)}>
                <SelectTrigger className="bg-secondary text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                  <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                  <SelectItem value="1:1">1:1 (Square)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">AI_MAX_RETRY_PER_STEP</Label>
              <Select value={String(settings.AI_MAX_RETRY_PER_STEP)} onValueChange={(v) => handleDefaultChange('AI_MAX_RETRY_PER_STEP', Number(v))}>
                <SelectTrigger className="bg-secondary text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">MAX_RENDER_RETRY</Label>
              <Select value={String(settings.MAX_RENDER_RETRY)} onValueChange={(v) => handleDefaultChange('MAX_RENDER_RETRY', Number(v))}>
                <SelectTrigger className="bg-secondary text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">FAILED_JOB_RETENTION_DAYS</Label>
              <Select value={String(settings.FAILED_JOB_RETENTION_DAYS)} onValueChange={(v) => handleDefaultChange('FAILED_JOB_RETENTION_DAYS', Number(v))}>
                <SelectTrigger className="bg-secondary text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[7, 14, 30, 60, 90].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} days</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Extended AI/Pipeline Settings */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowExtended(!showExtended)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Extended Pipeline Settings
            </CardTitle>
            {showExtended ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>
        {showExtended && (
          <CardContent className="space-y-1">
            {extendedToggles.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.key} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/30">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Icon className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <Label className="text-sm text-foreground font-medium">{t.label}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={t.value}
                    onCheckedChange={(v) => handleToggle(t.key, v)}
                    disabled={saving}
                  />
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// ---------- Health Tab ----------

function HealthTab() {
  const { settings } = useSettings();
  const { toast } = useToast();
  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [checking, setChecking] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const { logs } = await AdminService.getServiceHealthLogs(20);
    setHealthLogs(logs);
    setLoading(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  async function runCheck(name: string, url: string) {
    setChecking(name);
    const { data, error } = await AdminService.healthCheck(name, url);
    if (error) {
      toast({ title: 'Health check failed', description: error, variant: 'destructive' });
    } else {
      toast({ title: `${name}: ${data.status}`, description: `${data.response_time_ms}ms` });
    }
    await loadLogs();
    setChecking(null);
  }

  const services = [
    { name: 'local_llm', url: settings.LOCALLLMURL, label: 'Local LLM', icon: Zap },
    { name: 'local_render', url: settings.LOCALRENDERWORKERURL, label: 'Local Render Worker', icon: Server },
    { name: 'local_tts', url: settings.LOCAL_TTS_URL, label: 'Local TTS', icon: Volume2 },
  ];

  const statusIcon = (status: string) => {
    if (status === 'healthy') return <CheckCircle2 className="h-4 w-4 text-primary" />;
    if (status === 'unreachable') return <XCircle className="h-4 w-4 text-destructive" />;
    return <AlertCircle className="h-4 w-4 text-warning" />;
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {services.map((svc) => {
          const latestLog = healthLogs.find(l => l.service_name === svc.name);
          const Icon = svc.icon;
          return (
            <Card key={svc.name} className="border-border/50 bg-card/80">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {latestLog ? statusIcon(latestLog.status) : <Clock className="h-4 w-4 text-muted-foreground" />}
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{svc.label}</span>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => runCheck(svc.name, svc.url)}
                    disabled={checking === svc.name}
                    className="gap-1.5 text-xs"
                  >
                    {checking === svc.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Check
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate">{svc.url}</p>
                {latestLog && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Status: <span className={latestLog.status === 'healthy' ? 'text-primary' : 'text-destructive'}>{latestLog.status}</span></span>
                    {latestLog.response_time_ms && <span>{latestLog.response_time_ms}ms</span>}
                    <span>{new Date(latestLog.checked_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Health History */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Health Check History</CardTitle>
          <Button size="sm" variant="ghost" onClick={loadLogs} className="text-xs gap-1">
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground animate-pulse">Đang tải...</div>
          ) : healthLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có health check nào</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {healthLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                  <div className="flex items-center gap-2">
                    {statusIcon(log.status)}
                    <span className="text-sm text-foreground">{log.service_name}</span>
                    <Badge variant="outline" className="text-xs">{log.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {log.response_time_ms && <span>{log.response_time_ms}ms</span>}
                    <span>{new Date(log.checked_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Prompts Tab ----------

function PromptsTab() {
  const { toast } = useToast();
  const [prompts, setPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [form, setForm] = useState({ category: '', name: '', content: '', package_type: '' });

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    const { prompts: data } = await AdminService.getPrompts();
    setPrompts(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadPrompts(); }, [loadPrompts]);

  async function handleCreate() {
    if (!form.category || !form.name || !form.content) {
      toast({ title: 'Điền đầy đủ thông tin', variant: 'destructive' });
      return;
    }
    const { error } = await AdminService.upsertPrompt({
      category: form.category,
      name: form.name,
      content: form.content,
      package_type: form.package_type || null,
    });
    if (error) {
      toast({ title: 'Lỗi tạo prompt', description: error, variant: 'destructive' });
    } else {
      toast({ title: 'Prompt đã tạo' });
      setForm({ category: '', name: '', content: '', package_type: '' });
      setShowForm(false);
      await loadPrompts();
    }
  }

  async function handleNewVersion(prompt: any) {
    const newContent = editContent.trim();
    if (!newContent) return;
    const { error } = await AdminService.upsertPrompt({
      category: prompt.category,
      name: prompt.name,
      content: newContent,
      package_type: prompt.package_type,
      version: (prompt.version || 1) + 1,
    });
    if (error) {
      toast({ title: 'Lỗi tạo version', description: error, variant: 'destructive' });
    } else {
      toast({ title: `Prompt v${(prompt.version || 1) + 1} đã tạo` });
      setEditingId(null);
      setEditContent('');
      await loadPrompts();
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const { error } = await AdminService.togglePrompt(id, !current);
    if (error) toast({ title: 'Lỗi', description: error, variant: 'destructive' });
    else await loadPrompts();
  }

  const categories = [...new Set(prompts.map(p => p.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Prompt Registry ({prompts.length})</h3>
          <p className="text-xs text-muted-foreground">Quản lý prompt templates. Tạo version mới thay vì edit trực tiếp.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)} variant="outline" className="text-xs">
          {showForm ? 'Đóng' : '+ Thêm prompt'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/30 bg-card/80">
          <CardContent className="p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-secondary text-sm"><SelectValue placeholder="Chọn category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">system</SelectItem>
                    <SelectItem value="product_intel">product_intel</SelectItem>
                    <SelectItem value="commerce_concepts">commerce_concepts</SelectItem>
                    <SelectItem value="script_composer">script_composer</SelectItem>
                    <SelectItem value="caption">caption</SelectItem>
                    <SelectItem value="safety">safety</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Package Type (optional)</Label>
                <Select value={form.package_type} onValueChange={(v) => setForm(f => ({ ...f, package_type: v }))}>
                  <SelectTrigger className="bg-secondary text-sm"><SelectValue placeholder="All packages" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quickads">quickads</SelectItem>
                    <SelectItem value="reviewvideo">reviewvideo</SelectItem>
                    <SelectItem value="conversionvideo">conversionvideo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="bg-secondary text-sm" placeholder="e.g. system_prompt_v2" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Content</Label>
              <Textarea value={form.content} onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))} className="bg-secondary text-sm min-h-[120px] font-mono" placeholder="Prompt content..." />
            </div>
            <Button onClick={handleCreate} size="sm" className="gap-1">
              <FileText className="h-3 w-3" /> Tạo prompt
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="animate-pulse text-muted-foreground text-sm">Đang tải...</div>
      ) : prompts.length === 0 ? (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Chưa có prompt nào. Tạo prompt đầu tiên.
          </CardContent>
        </Card>
      ) : (
        categories.map(cat => (
          <div key={cat} className="space-y-2">
            <h4 className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Hash className="h-3 w-3" /> {cat}
            </h4>
            {prompts.filter(p => p.category === cat).map(p => (
              <Card key={p.id} className={`border-border/50 ${p.is_active ? 'bg-card/80' : 'bg-muted/30 opacity-60'}`}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{p.name}</span>
                      <Badge variant="outline" className="text-xs">v{p.version}</Badge>
                      {p.package_type && <Badge variant="secondary" className="text-xs">{p.package_type}</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => {
                          if (editingId === p.id) { setEditingId(null); setEditContent(''); }
                          else { setEditingId(p.id); setEditContent(p.content); }
                        }}
                        className="h-7 px-2 text-xs gap-1"
                      >
                        <Edit3 className="h-3 w-3" /> {editingId === p.id ? 'Cancel' : 'New Version'}
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => toggleActive(p.id, p.is_active)}
                        className="h-7 px-2 text-xs gap-1"
                      >
                        {p.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {p.is_active ? 'Active' : 'Inactive'}
                      </Button>
                    </div>
                  </div>

                  {editingId === p.id ? (
                    <div className="space-y-2 mt-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="bg-secondary text-sm min-h-[100px] font-mono"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleNewVersion(p)} className="gap-1 text-xs">
                          <Save className="h-3 w-3" /> Tạo v{(p.version || 1) + 1}
                        </Button>
                        <p className="text-xs text-muted-foreground self-center">
                          Sẽ tạo version mới, version cũ vẫn giữ nguyên.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground font-mono line-clamp-3">{p.content}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

// ---------- Ops Tab ----------

interface UsageStepStats {
  count: number;
  credits: number;
  failures: number;
  avg_latency_ms: number | null;
}

interface RenderSummary {
  total: number;
  completed: number;
  failed: number;
  queued: number;
  processing: number;
  cancelled: number;
}

function OpsTab() {
  const { toast } = useToast();
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [failedJobs, setFailedJobs] = useState<any[]>([]);
  const [usageStats, setUsageStats] = useState<Record<string, UsageStepStats> | null>(null);
  const [renderSummary, setRenderSummary] = useState<RenderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeOpsTab, setActiveOpsTab] = useState<'failed' | 'audit' | 'usage'>('failed');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [auditRes, failedRes, usageRes] = await Promise.all([
        AdminService.getAuditLogs(50),
        AdminService.getFailedJobs(30),
        AdminService.getUsageStats(),
      ]);
      setAuditLogs(auditRes.logs);
      setFailedJobs(failedRes.data?.jobs ?? []);
      setUsageStats(usageRes.data?.stats ?? null);
      setRenderSummary(usageRes.data?.render_summary ?? null);
    } catch (err: any) {
      console.error('[OpsTab] Failed to load data:', err);
      toast({ title: 'Lỗi tải dữ liệu', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading) return <LoadingState message="Đang tải ops data..." />;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'failed' as const, icon: AlertTriangle, label: `Failed Jobs (${failedJobs.length})` },
          { key: 'audit' as const, icon: FileText, label: `Audit (${auditLogs.length})` },
          { key: 'usage' as const, icon: BarChart3, label: 'Usage Dashboard' },
        ]).map(tab => (
          <Button
            key={tab.key}
            size="sm"
            variant={activeOpsTab === tab.key ? 'default' : 'outline'}
            onClick={() => setActiveOpsTab(tab.key)}
            className="text-xs gap-1"
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={loadAll} className="text-xs gap-1 ml-auto">
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </div>

      {/* Failed Jobs */}
      {activeOpsTab === 'failed' && (
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <p className="text-xs text-muted-foreground">Render jobs có status=failed. Error code + message từ edge function.</p>
          </CardHeader>
          <CardContent className="p-0">
            {failedJobs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Không có job thất bại 🎉</div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto divide-y divide-border/20">
                {failedJobs.map((job: any) => (
                  <div key={job.id} className="p-3 hover:bg-secondary/20">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                        <span className="text-sm text-foreground">{job.projects?.title || job.project_id.slice(0, 8)}</span>
                        <Badge variant="outline" className="text-xs">{job.render_mode}</Badge>
                        {job.projects?.package_type && <Badge variant="secondary" className="text-xs">{job.projects.package_type}</Badge>}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs text-destructive/80 mt-1">
                      {job.error_code && <span className="font-mono bg-destructive/10 px-1.5 py-0.5 rounded mr-2">{job.error_code}</span>}
                      {job.error_message || 'Unknown error'}
                    </div>
                    {job.last_fail_reason && job.last_fail_reason !== job.error_message && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">Reason: {job.last_fail_reason}</p>
                    )}
                    {job.duration_ms && (
                      <p className="text-xs text-muted-foreground mt-0.5">Duration: {(job.duration_ms / 1000).toFixed(1)}s</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audit Logs */}
      {activeOpsTab === 'audit' && (
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <p className="text-xs text-muted-foreground">Mỗi setting change, health check, prompt update đều ghi audit log.</p>
          </CardHeader>
          <CardContent className="p-0">
            {auditLogs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Chưa có audit log</div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto divide-y divide-border/20">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3 hover:bg-secondary/20">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{log.action}</Badge>
                        <span className="text-xs text-muted-foreground">{log.target_type}</span>
                        {log.target_key && <span className="text-xs font-mono text-foreground/70">{log.target_key}</span>}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                    {(log.old_value || log.new_value) && (
                      <div className="flex gap-4 text-xs mt-1">
                        {log.old_value && <span className="text-destructive/70">Old: {JSON.stringify(log.old_value)}</span>}
                        {log.new_value && <span className="text-primary/70">New: {JSON.stringify(log.new_value)}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Usage Dashboard */}
      {activeOpsTab === 'usage' && (
        <div className="space-y-4">
          {/* Render Summary Cards */}
          {renderSummary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Total Renders', value: renderSummary.total, color: 'text-foreground' },
                { label: 'Completed', value: renderSummary.completed, color: 'text-primary' },
                { label: 'Failed', value: renderSummary.failed, color: 'text-destructive' },
                { label: 'Processing', value: renderSummary.queued + renderSummary.processing, color: 'text-warning' },
                { label: 'Failure Rate', value: renderSummary.total > 0 ? `${((renderSummary.failed / renderSummary.total) * 100).toFixed(1)}%` : '0%', color: renderSummary.failed > 0 ? 'text-destructive' : 'text-primary' },
              ].map((stat) => (
                <Card key={stat.label} className="border-border/50 bg-card/80">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Step-by-step usage */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pipeline Step Usage</CardTitle>
              <p className="text-xs text-muted-foreground">Calls, credits, failures, and avg latency per pipeline step.</p>
            </CardHeader>
            <CardContent>
              {!usageStats ? (
                <p className="text-sm text-muted-foreground">Không có dữ liệu</p>
              ) : (
                <div className="space-y-1">
                  {/* Header */}
                  <div className="grid grid-cols-5 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                    <span>Step</span>
                    <span className="text-right">Calls</span>
                    <span className="text-right">Credits</span>
                    <span className="text-right">Failures</span>
                    <span className="text-right">Avg Latency</span>
                  </div>
                  {Object.entries(usageStats)
                    .sort(([, a], [, b]) => b.count - a.count)
                    .map(([step, stats]) => (
                    <div key={step} className="grid grid-cols-5 gap-2 px-3 py-2.5 text-sm border-b border-border/20 last:border-0 hover:bg-secondary/20">
                      <span className="font-mono text-xs text-foreground flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-primary shrink-0" />
                        <span className="truncate">{step}</span>
                      </span>
                      <span className="text-right text-foreground font-medium">{stats.count}</span>
                      <span className="text-right text-foreground">{stats.credits}</span>
                      <span className={`text-right font-medium ${stats.failures > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {stats.failures}
                      </span>
                      <span className="text-right text-muted-foreground">
                        {stats.avg_latency_ms !== null ? `${stats.avg_latency_ms}ms` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ---------- Main Page ----------

const AdminSettings = () => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Admin Control Plane</h1>
          <p className="text-xs text-muted-foreground">Backend enforcement is mandatory — UI hiding alone is not sufficient.</p>
        </div>
      </div>

      <Tabs defaultValue="policy" className="w-full">
        <TabsList className="bg-secondary/50 w-full md:w-auto">
          <TabsTrigger value="policy" className="gap-1"><Shield className="h-3.5 w-3.5" /> Policy</TabsTrigger>
          <TabsTrigger value="health" className="gap-1"><Activity className="h-3.5 w-3.5" /> Health</TabsTrigger>
          <TabsTrigger value="prompts" className="gap-1"><FileText className="h-3.5 w-3.5" /> Prompts</TabsTrigger>
          <TabsTrigger value="ops" className="gap-1"><BarChart3 className="h-3.5 w-3.5" /> Ops</TabsTrigger>
        </TabsList>

        <TabsContent value="policy" className="mt-4"><PolicyTab /></TabsContent>
        <TabsContent value="health" className="mt-4"><HealthTab /></TabsContent>
        <TabsContent value="prompts" className="mt-4"><PromptsTab /></TabsContent>
        <TabsContent value="ops" className="mt-4"><OpsTab /></TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default AdminSettings;
