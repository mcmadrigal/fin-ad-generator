'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { AssetSpec } from '@/types';
import { renderAdToCanvas } from '@/lib/canvasRenderer';

const PREVIEW_MAX_W = 300;
const PREVIEW_MAX_H = 240;

function calcPreviewDims(w: number, h: number): { pw: number; ph: number } {
  const scaleX = PREVIEW_MAX_W / w;
  const scaleY = PREVIEW_MAX_H / h;
  const scale  = Math.min(scaleX, scaleY, 1);
  return { pw: Math.round(w * scale), ph: Math.round(h * scale) };
}

interface Props {
  spec:          AssetSpec;
  text:          string;
  cta:           string;
  backgroundSrc: string;
}

export function CanvasAd({ spec, text, cta, backgroundSrc }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { pw, ph } = calcPreviewDims(spec.width, spec.height);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      await renderAdToCanvas(canvas, pw, ph, text, cta, backgroundSrc);
    } catch (err) {
      console.error(`[CanvasAd] render failed for ${spec.key}:`, err);
    }
  }, [pw, ph, text, cta, backgroundSrc, spec.key]);

  useEffect(() => {
    render();
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      width={pw}
      height={ph}
      style={{ display: 'block', width: pw, height: ph, borderRadius: 2 }}
      aria-label={`Ad preview for ${spec.label}`}
    />
  );
}
