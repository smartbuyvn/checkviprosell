/**
 * Viprosell — QuickAds Remotion Template (Phase 1)
 *
 * Input: SceneGraph JSON (validated)
 * Output: Rendered video supporting 9:16 and 1:1 aspect ratios
 *
 * COMPOSITION CONTRACT:
 * - 30fps fixed
 * - Frame dimensions computed from aspect_ratio
 * - Every scene is rendered as a discrete segment
 * - Text overlays use CSS transforms only (no canvas, no WebGL)
 * - Animations: CSS transform + opacity only (cheap render)
 * - Safe areas respected (text never overlaps platform UI zones)
 */

import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Img,
} from 'remotion';

import type {
  SceneGraph,
  Scene,
  TextOverlay,
} from '../types/scene-graph';
import {
  AnimationType,
  LayoutType,
  TextStyle,
  AssetFitMode,
} from '../types/scene-graph';

// ─── Frame dimensions per aspect ratio ──────────────────────────────────────

export const ASPECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1':  { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
};

// ─── Safe area constants (platform UI zones to avoid) ───────────────────────

const SAFE_AREA = {
  top: 0.06,    // 6% from top (status bar / story UI)
  bottom: 0.10, // 10% from bottom (action buttons / swipe area)
};

// ─── Text Style Map ──────────────────────────────────────────────────────────

function getTextStyles(style: TextStyle, brandColor: string): React.CSSProperties {
  const base: React.CSSProperties = {
    fontFamily: '"Inter", "Helvetica Neue", sans-serif',
    textAlign: 'center',
    padding: '0 32px',
    letterSpacing: '-0.02em',
  };

  switch (style) {
    case TextStyle.HEADLINE:
      return {
        ...base,
        fontSize: 54,
        fontWeight: 800,
        color: '#FFFFFF',
        lineHeight: 1.15,
        textShadow: '0 2px 16px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.5)',
      };
    case TextStyle.BODY:
      return {
        ...base,
        fontSize: 32,
        fontWeight: 500,
        color: '#F0F0F0',
        lineHeight: 1.4,
        textShadow: '0 1px 8px rgba(0,0,0,0.6)',
      };
    case TextStyle.BADGE:
      return {
        ...base,
        fontSize: 26,
        fontWeight: 700,
        color: '#FFFFFF',
        backgroundColor: brandColor,
        borderRadius: 100,
        padding: '8px 28px',
        display: 'inline-block',
        textShadow: 'none',
      };
    case TextStyle.CTA:
      return {
        ...base,
        fontSize: 40,
        fontWeight: 800,
        color: '#FFFFFF',
        backgroundColor: brandColor,
        borderRadius: 16,
        padding: '20px 60px',
        display: 'inline-block',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        textShadow: 'none',
      };
    case TextStyle.CAPTION:
      return {
        ...base,
        fontSize: 24,
        fontWeight: 400,
        color: '#D0D0D0',
        textShadow: '0 1px 6px rgba(0,0,0,0.5)',
      };
    default:
      return base;
  }
}

// ─── Overlay Component ──────────────────────────────────────────────────────

interface OverlayProps {
  overlay: TextOverlay;
  frame: number;
  height: number;
  brandColor: string;
}

const OverlayText: React.FC<OverlayProps> = ({ overlay, frame, height, brandColor }) => {
  const relativeFrame = Math.max(0, frame - (overlay.delay_frames ?? 0));

  let opacity = 1;
  let translateY = 0;

  if (overlay.entrance === 'fade_in') {
    opacity = interpolate(relativeFrame, [0, 12], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.ease),
    });
  } else if (overlay.entrance === 'slide_up') {
    opacity = interpolate(relativeFrame, [0, 10], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    translateY = interpolate(relativeFrame, [0, 14], [30, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });
  }

  // Position relative to frame height, with safe area clamping
  const rawTop = overlay.position_y * height;
  const safeTop = Math.max(height * SAFE_AREA.top, Math.min(rawTop, height * (1 - SAFE_AREA.bottom - 0.06)));

  const style: React.CSSProperties = {
    position: 'absolute',
    top: safeTop,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: overlay.align === 'left' ? 'flex-start'
      : overlay.align === 'right' ? 'flex-end'
      : 'center',
    opacity,
    transform: `translateY(${translateY}px)`,
    paddingLeft: overlay.align === 'left' ? 40 : 0,
    paddingRight: overlay.align === 'right' ? 40 : 0,
    zIndex: 10,
  };

  return (
    <div style={style}>
      <span style={getTextStyles(overlay.style as TextStyle, brandColor)}>
        {overlay.text}
      </span>
    </div>
  );
};

// ─── Asset / Image Component ────────────────────────────────────────────────

interface AssetProps {
  scene: Scene;
  frame: number;
  width: number;
  height: number;
}

const SceneAssetView: React.FC<AssetProps> = ({ scene, frame, width, height }) => {
  if (!scene.asset) return null;

  const { animation, asset } = scene;
  const { src, fit } = asset;

  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  const progress = interpolate(frame, [0, scene.duration_frames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });

  switch (animation) {
    case AnimationType.ZOOM_IN:
      scale = interpolate(progress, [0, 1], [1.0, 1.12]);
      break;
    case AnimationType.ZOOM_OUT:
      scale = interpolate(progress, [0, 1], [1.12, 1.0]);
      break;
    case AnimationType.PAN_LEFT:
      scale = 1.08;
      translateX = interpolate(progress, [0, 1], [0, -width * 0.06]);
      break;
    case AnimationType.PAN_RIGHT:
      scale = 1.08;
      translateX = interpolate(progress, [0, 1], [0, width * 0.06]);
      break;
    case AnimationType.FADE_IN:
      scale = 1;
      break;
    case AnimationType.WIPE_LEFT:
      scale = 1;
      break;
    case AnimationType.STATIC:
    default:
      scale = 1;
  }

  // Fade in for all scenes (first 6 frames)
  const fadeIn = interpolate(frame, [0, 6], [0.85, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const objectFit =
    fit === AssetFitMode.CONTAIN ? 'contain'
    : fit === AssetFitMode.FILL ? 'fill'
    : 'cover';

  // Clip reveal for wipe_left
  const clipPath = animation === AnimationType.WIPE_LEFT
    ? `inset(0 ${interpolate(progress, [0, 1], [100, 0])}% 0 0)`
    : undefined;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity: fadeIn,
        clipPath,
      }}
    >
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit,
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
          transformOrigin: `${(asset.focal_x ?? 0.5) * 100}% ${(asset.focal_y ?? 0.5) * 100}%`,
        }}
      />
    </div>
  );
};

// ─── Dark overlay (for text legibility) ─────────────────────────────────────

const DarkOverlay: React.FC<{ layout: LayoutType }> = ({ layout }) => {
  if (layout === LayoutType.TEXT_ONLY || layout === LayoutType.CTA_CARD) return null;

  const gradientStyle: React.CSSProperties =
    layout === LayoutType.IMAGE_TOP_TEXT_BOTTOM
      ? {
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.0) 50%, rgba(0,0,0,0.75) 100%)',
        }
      : {
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.5) 100%)',
        };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        ...gradientStyle,
      }}
    />
  );
};

// ─── Scene Component ─────────────────────────────────────────────────────────

interface SceneViewProps {
  scene: Scene;
  width: number;
  height: number;
  brandColor: string;
}

const SceneView: React.FC<SceneViewProps> = ({ scene, width, height, brandColor }) => {
  const frame = useCurrentFrame();

  const bgColor = scene.bg_color ?? '#000000';

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      {/* Asset layer */}
      <SceneAssetView scene={scene} frame={frame} width={width} height={height} />

      {/* Gradient dark overlay for readability */}
      <DarkOverlay layout={scene.layout as LayoutType} />

      {/* Text overlays */}
      {scene.overlays.map((overlay, idx) => (
        <OverlayText
          key={idx}
          overlay={overlay}
          frame={frame}
          height={height}
          brandColor={brandColor}
        />
      ))}
    </AbsoluteFill>
  );
};

// ─── Root Composition ────────────────────────────────────────────────────────

export interface QuickAdsTemplateProps {
  sceneGraph: SceneGraph;
}

export const QuickAdsTemplate: React.FC<QuickAdsTemplateProps> = ({ sceneGraph }) => {
  const { width, height } = useVideoConfig();
  const { meta, scenes } = sceneGraph;
  const brandColor = meta.brand_color ?? '#FF4C61';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', fontFamily: 'Inter, sans-serif' }}>
      {scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.start_frame}
          durationInFrames={scene.duration_frames}
          name={scene.id}
        >
          <SceneView
            scene={scene}
            width={width}
            height={height}
            brandColor={brandColor}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// ─── Remotion Root (register compositions) ──────────────────────────────────
// This file is also imported by the Remotion bundle entry point.
// See remotion.config.ts and src/remotion/index.tsx for registration.
