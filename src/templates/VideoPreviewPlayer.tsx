/**
 * Viprosell — Remotion Preview Player Component (Phase 1)
 * Wraps @remotion/player for in-browser preview
 * No server render needed — browser renders the composition
 */

import React, { useMemo } from 'react';
import { Player } from '@remotion/player';
import { QuickAdsTemplate, ASPECT_DIMENSIONS } from './QuickAdsTemplate';
import type { SceneGraph } from '../types/scene-graph';
import { validateSceneGraph } from '../types/scene-graph.validator';

interface VideoPreviewPlayerProps {
  sceneGraph: SceneGraph;
  /** Override render width. Defaults to dimensions for aspect_ratio */
  width?: number;
  /** Override render height. Defaults to dimensions for aspect_ratio */
  height?: number;
  className?: string;
}

export const VideoPreviewPlayer: React.FC<VideoPreviewPlayerProps> = ({
  sceneGraph,
  width,
  height,
  className,
}) => {
  const validation = useMemo(() => validateSceneGraph(sceneGraph), [sceneGraph]);

  if (!validation.valid) {
    return (
      <div
        style={{
          backgroundColor: '#1a1a1a',
          color: '#ff4c61',
          padding: 24,
          borderRadius: 12,
          fontFamily: 'monospace',
          fontSize: 13,
        }}
      >
        <strong>⛔ SceneGraph Validation Failed</strong>
        <ul style={{ marginTop: 12, lineHeight: 1.8 }}>
          {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      </div>
    );
  }

  const { meta } = validation.data!;
  const dims = ASPECT_DIMENSIONS[meta.aspect_ratio] ?? ASPECT_DIMENSIONS['9:16'];
  const compositionWidth = width ?? dims.width;
  const compositionHeight = height ?? dims.height;

  // Scale down for preview display
  const previewScale = 360 / compositionHeight;
  const previewWidth = Math.round(compositionWidth * previewScale);
  const previewHeight = 360;

  return (
    <div className={className}>
      {validation.warnings.length > 0 && (
        <div style={{ color: '#f59e0b', fontSize: 12, marginBottom: 8, fontFamily: 'monospace' }}>
          ⚠ {validation.warnings.join(' | ')}
        </div>
      )}
      <Player
        component={QuickAdsTemplate}
        inputProps={{ sceneGraph: validation.data! }}
        durationInFrames={meta.total_frames}
        compositionWidth={compositionWidth}
        compositionHeight={compositionHeight}
        fps={30}
        style={{ width: previewWidth, height: previewHeight }}
        controls
        loop
      />
    </div>
  );
};
