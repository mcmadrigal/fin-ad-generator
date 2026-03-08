'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { AssetSpec } from '@/types';
import { renderAdToCanvas } from '@/lib/canvasRenderer';

const PREVIEW_MAX_W = 300;
const PREVIEW_MAX_H = 240;

function calcPreviewDims(w: number, h: number): { pw: number; ph: number } {
  const scale = Math.min(PREVIEW_MAX_W / w, PREVIEW_MAX_H / h, 1);
  return { pw: Math.round(w * scale), ph: Math.round(h * scale) };
}

interface Props {
  spec:          AssetSpec;
  text:          string;
  cta:           string;
  backgroundSrc: string;
  onClick?:      () => void;
}

export function CanvasAd({ spec, text, cta, backgroundSrc, onClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { pw, ph } = calcPreviewDims(spec.width, spec.height);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      // Pass spec.width/height so renderAdToCanvas can look up the correct
      // FORMAT_SPEC and apply proportional scaling to the preview dimensions.
      await renderAdToCanvas(canvas, pw, ph, text, cta, backgroundSrc, spec.width, spec.height);
    } catch (err) {
      console.error(`[CanvasAd] render failed for ${spec.key}:`, err);
    }
  }, [pw, ph, text, cta, backgroundSrc, spec.key, spec.width, spec.height]);

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
        // Preserve aspect ratio when grid cell is narrower than pw.
        // Modern browsers scale canvas height proportionally when only
        // max-width constrains the CSS width (canvas is a replaced element).
        maxWidth:     '100%',
        height:       'auto',
      }}
      aria-label={`Ad preview for ${spec.label}`}
    />
  );
}
