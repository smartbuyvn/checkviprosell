/**
 * Viprosell — Scene Preview Dev Page (Phase 1)
 * Route: /scene-preview
 *
 * PURPOSE: Test SceneGraph JSON → Validator → Remotion render pipeline directly from browser.
 * - Public route (no auth needed for QA)
 * - Live JSON editor with syntax highlighting
 * - Real-time validator feedback
 * - Remotion Player preview (9:16 and 1:1)
 * - Aspect ratio switcher
 * - Load sample JSON button
 */

import React, { useState, useCallback, useMemo } from 'react';
import { VideoPreviewPlayer } from '@/templates/VideoPreviewPlayer';
import { validateSceneGraph } from '@/types/scene-graph.validator';
import type { SceneGraph } from '@/types/scene-graph';
import { AspectRatioTarget } from '@/types/scene-graph';
import sampleJson from '@/types/sample-scene-graph.quick-ads.json';

// ─── Styles (inline — no Tailwind dependency for this dev tool) ───────────────

const C = {
  bg: '#0D0D0F',
  surface: '#18181C',
  border: '#2A2A32',
  accent: '#FF4C61',
  accentSoft: 'rgba(255,76,97,0.12)',
  textPrimary: '#F0F0F2',
  textMuted: '#8888A0',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  codeFont: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    backgroundColor: C.bg,
    color: C.textPrimary,
    fontFamily: '"Inter", "Helvetica Neue", sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    borderBottom: `1px solid ${C.border}`,
    padding: '16px 32px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    background: C.surface,
  },
  headerBadge: {
    background: C.accentSoft,
    color: C.accent,
    border: `1px solid ${C.accent}`,
    borderRadius: 6,
    padding: '2px 10px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: C.textPrimary,
    margin: 0,
  },
  subtitle: {
    fontSize: 12,
    color: C.textMuted,
    margin: 0,
  },
  main: {
    display: 'flex',
    flex: 1,
    gap: 0,
    overflow: 'hidden',
    height: 'calc(100vh - 65px)',
  },
  // Left panel: editor
  leftPanel: {
    width: '50%',
    display: 'flex',
    flexDirection: 'column',
    borderRight: `1px solid ${C.border}`,
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '12px 20px',
    borderBottom: `1px solid ${C.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: C.surface,
    flexShrink: 0,
  },
  panelTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: C.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  btnGroup: {
    display: 'flex',
    gap: 8,
  },
  btn: {
    padding: '6px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: `1px solid ${C.border}`,
    background: C.surface,
    color: C.textPrimary,
    transition: 'all 0.15s',
  },
  btnPrimary: {
    background: C.accent,
    border: `1px solid ${C.accent}`,
    color: '#fff',
  },
  textarea: {
    flex: 1,
    width: '100%',
    background: '#111114',
    color: '#E8E8EE',
    border: 'none',
    outline: 'none',
    padding: '20px',
    fontFamily: C.codeFont,
    fontSize: 12,
    lineHeight: 1.7,
    resize: 'none' as const,
    tabSize: 2,
    overflowY: 'auto' as const,
    boxSizing: 'border-box' as const,
  },
  // Right panel: preview + validation
  rightPanel: {
    width: '50%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  previewSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 20px',
    borderBottom: `1px solid ${C.border}`,
    background: '#0a0a0c',
    gap: 16,
  },
  aspectBtns: {
    display: 'flex',
    gap: 8,
  },
  aspectBtn: {
    padding: '5px 14px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: `1px solid ${C.border}`,
    background: 'transparent',
    color: C.textMuted,
    transition: 'all 0.15s',
  },
  aspectBtnActive: {
    background: C.accentSoft,
    border: `1px solid ${C.accent}`,
    color: C.accent,
  },
  playerWrap: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  validationSection: {
    flex: 1,
    overflow: 'auto',
    padding: '16px 20px',
  },
  validLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: 700,
  },
  dot: (color: string): React.CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
    boxShadow: `0 0 6px ${color}`,
  }),
  errorList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  errorItem: (type: 'error' | 'warning'): React.CSSProperties => ({
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontFamily: C.codeFont,
    lineHeight: 1.6,
    background: type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
    border: `1px solid ${type === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`,
    color: type === 'error' ? '#FCA5A5' : '#FCD34D',
  }),
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 12,
  },
  metaChip: {
    padding: '4px 10px',
    borderRadius: 6,
    fontSize: 11,
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${C.border}`,
    color: C.textMuted,
    fontFamily: C.codeFont,
  },
  emptyState: {
    color: C.textMuted,
    fontSize: 13,
    textAlign: 'center' as const,
    padding: '32px 20px',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

const SAMPLE_JSON = JSON.stringify(sampleJson, null, 2);

export default function ScenePreview() {
  const [jsonText, setJsonText] = useState(SAMPLE_JSON);
  const [previewAspect, setPreviewAspect] = useState<string>('9:16');
  const [activeJson, setActiveJson] = useState<string>(SAMPLE_JSON);

  // Parse + validate on every "Apply" or load
  const { parsed, parseError } = useMemo(() => {
    try {
      return { parsed: JSON.parse(activeJson), parseError: null };
    } catch (e: any) {
      return { parsed: null, parseError: `JSON parse error: ${e.message}` };
    }
  }, [activeJson]);

  const validation = useMemo(() => {
    if (!parsed) return null;
    return validateSceneGraph(parsed);
  }, [parsed]);

  // Override aspect ratio for preview (editor JSON aspect_ratio is respected by default)
  const previewGraph = useMemo((): SceneGraph | null => {
    if (!validation?.valid || !validation.data) return null;
    if (previewAspect === 'override') return validation.data;
    // inject chosen aspect ratio override into the preview
    return {
      ...validation.data,
      meta: { ...validation.data.meta, aspect_ratio: previewAspect as AspectRatioTarget },
    };
  }, [validation, previewAspect]);

  const handleApply = useCallback(() => {
    setActiveJson(jsonText);
  }, [jsonText]);

  const handleLoadSample = useCallback(() => {
    setJsonText(SAMPLE_JSON);
    setActiveJson(SAMPLE_JSON);
  }, []);

  const handleFormat = useCallback(() => {
    try {
      const formatted = JSON.stringify(JSON.parse(jsonText), null, 2);
      setJsonText(formatted);
    } catch {
      // Ignore if invalid JSON
    }
  }, [jsonText]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter → Apply
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
    // Tab → insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newVal = el.value.substring(0, start) + '  ' + el.value.substring(end);
      setJsonText(newVal);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  }, [handleApply]);

  const sceneCount = validation?.data?.scenes.length;
  const totalSec = validation?.data
    ? Math.round(validation.data.meta.total_frames / 30)
    : null;

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <h1 style={styles.title}>🎬 SceneGraph Preview</h1>
          <p style={styles.subtitle}>
            Phase 1 · JSON → Validator → Remotion render · v.ninhle.com/scene-preview
          </p>
        </div>
        <span style={styles.headerBadge}>DEV / QA</span>
      </header>

      {/* Main layout */}
      <main style={styles.main}>

        {/* LEFT: JSON Editor */}
        <div style={styles.leftPanel}>
          <div style={styles.panelHeader}>
            <span style={styles.panelTitle}>SceneGraph JSON Editor</span>
            <div style={styles.btnGroup}>
              <button style={styles.btn} onClick={handleFormat}>Format</button>
              <button style={styles.btn} onClick={handleLoadSample}>Load Sample</button>
              <button
                style={{ ...styles.btn, ...styles.btnPrimary }}
                onClick={handleApply}
                title="Ctrl+Enter"
              >
                ▶ Apply
              </button>
            </div>
          </div>
          <textarea
            style={styles.textarea}
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            placeholder='Paste your SceneGraph JSON here, then click "Apply"...'
          />
          <div style={{
            padding: '8px 20px',
            borderTop: `1px solid ${C.border}`,
            fontSize: 11,
            color: C.textMuted,
            background: C.surface,
          }}>
            Ctrl+Enter to apply · Tab for indent · JSON Schema v1.0
          </div>
        </div>

        {/* RIGHT: Preview + Validation */}
        <div style={styles.rightPanel}>

          {/* Aspect ratio switcher + Player */}
          <div style={styles.previewSection}>
            <div style={styles.panelHeader as React.CSSProperties}>
              <span style={styles.panelTitle}>Preview</span>
              <div style={styles.aspectBtns}>
                {(['9:16', '1:1'] as const).map(ar => (
                  <button
                    key={ar}
                    style={{
                      ...styles.aspectBtn,
                      ...(previewAspect === ar ? styles.aspectBtnActive : {}),
                    }}
                    onClick={() => setPreviewAspect(ar)}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.playerWrap}>
              {parseError ? (
                <div style={{ color: C.error, fontFamily: C.codeFont, fontSize: 13, padding: 24 }}>
                  ⛔ {parseError}
                </div>
              ) : previewGraph ? (
                <VideoPreviewPlayer sceneGraph={previewGraph} />
              ) : validation && !validation.valid ? (
                <div style={{ color: C.error, fontFamily: C.codeFont, fontSize: 13, padding: 24, textAlign: 'center' }}>
                  ⛔ Validation failed — fix errors below to preview
                </div>
              ) : (
                <div style={styles.emptyState}>
                  Paste a SceneGraph JSON and click <strong>▶ Apply</strong>
                </div>
              )}
            </div>
          </div>

          {/* Validation output */}
          <div style={styles.validationSection}>
            <div style={styles.panelHeader as React.CSSProperties}>
              <span style={styles.panelTitle}>Validation Output</span>
              {validation && (
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: validation.valid ? C.success : C.error,
                }}>
                  {validation.valid ? '✅ VALID' : `❌ FAILED (${validation.errors.length} errors)`}
                </span>
              )}
            </div>

            {/* Status dot + summary */}
            {validation && (
              <>
                <div style={styles.validLabel}>
                  <span style={styles.dot(validation.valid ? C.success : C.error)} />
                  <span>
                    {validation.valid
                      ? `Valid — ${sceneCount} scenes · ${totalSec}s · ${validation.data?.meta.aspect_ratio}`
                      : `${validation.errors.length} error${validation.errors.length !== 1 ? 's' : ''} detected`}
                  </span>
                </div>

                {/* Meta chips when valid */}
                {validation.valid && validation.data && (
                  <div style={styles.metaRow}>
                    <span style={styles.metaChip}>📦 {validation.data.meta.package_type}</span>
                    <span style={styles.metaChip}>📐 {validation.data.meta.aspect_ratio}</span>
                    <span style={styles.metaChip}>🎬 {sceneCount} scenes</span>
                    <span style={styles.metaChip}>⏱ {totalSec}s @ 30fps</span>
                    <span style={styles.metaChip}>🔊 {validation.data.meta.voiceover_mode}</span>
                    <span style={styles.metaChip}>🏷 {validation.data.meta.brand_name}</span>
                    <span style={styles.metaChip}>📋 schema v{validation.data.schema_version}</span>
                  </div>
                )}

                {/* Scene breakdown */}
                {validation.valid && validation.data && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Scene Breakdown
                    </div>
                    {validation.data.scenes.map((scene, i) => (
                      <div key={scene.id} style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        marginBottom: 4,
                        background: 'rgba(255,255,255,0.04)',
                        border: `1px solid ${C.border}`,
                        fontSize: 12,
                        fontFamily: C.codeFont,
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                      }}>
                        <span style={{ color: C.accent, minWidth: 20 }}>{i + 1}.</span>
                        <span style={{ color: C.textPrimary, flex: 1 }}>{scene.id}</span>
                        <span style={{ color: C.textMuted }}>{scene.layout}</span>
                        <span style={{ color: C.textMuted }}>{scene.animation}</span>
                        <span style={{ color: C.textMuted }}>{Math.round(scene.duration_frames / 30 * 10) / 10}s</span>
                        <span style={{ color: C.textMuted }}>{scene.overlays.length} overlay{scene.overlays.length !== 1 ? 's' : ''}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Errors */}
                {validation.errors.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: C.error, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      ❌ Errors ({validation.errors.length})
                    </div>
                    <ul style={styles.errorList}>
                      {validation.errors.map((e, i) => (
                        <li key={i} style={styles.errorItem('error')}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings */}
                {validation.warnings.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: C.warning, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      ⚠ Warnings ({validation.warnings.length})
                    </div>
                    <ul style={styles.errorList}>
                      {validation.warnings.map((w, i) => (
                        <li key={i} style={styles.errorItem('warning')}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {!validation && !parseError && (
              <div style={styles.emptyState}>
                Paste JSON and click <strong>▶ Apply</strong> to validate
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
