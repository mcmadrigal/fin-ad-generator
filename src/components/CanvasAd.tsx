'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { AssetSpec } from '@/types';
import { renderAdToCanvas } from '@/lib/canvasRenderer';

const PREVIEW_MAX_W = 300;

function calcPreviewDims(w: number, h: number): { pw: number; ph: number } {
  const scale = Math.min(PREVIEW_MAX_W / w, 1);
  return { pw: Math.round(w * scale), ph: Math.round(h * scale) };
}

interface Props {
  spec:            AssetSpec;
  text:            string;
  subheadline:     string;
  cta:             string;
  showSubheadline: boolean;
  showCta:         boolean;
  backgroundSrc:   string;
  onClick?:        () => void;
}

export function CanvasAd({ spec, text, subheadline, cta, showSubheadline, showCta, backgroundSrc, onClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { pw, ph } = calcPreviewDims(spec.width, spec.height);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      // Pass spec.width/height so renderAdToCanvas can look up the correct
      // FORMAT_SPEC and apply proportional scaling to the preview dimensions.
      await renderAdToCanvas(canvas, pw, ph, text, subheadline, cta, showSubheadline, showCta, backgroundSrc, spec.width, spec.height);
    } catch (err) {
      console.error(`[CanvasAd] render failed for ${spec.key}:`, err);
    }
  }, [pw, ph, text, subheadline, cta, showSubheadline, showCta, backgroundSrc, spec.key, spec.width, spec.height]);

  useEffect(() => {
    render();
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      width={pw}
      height={ph}
      onClick={onClick}
      style={{
        borderRadius: 2,
        cursor:       onClick ? 'pointer' : undefined,
        display:      'block',
        // Fill the grid cell width; height scales proportionally.
        // Canvas has intrinsic dimensions so height:auto works like img.
        width:        '100%',
        height:       'auto',
      }}
      aria-label={`Ad preview for ${spec.label}`}
    />
  );
}
