'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { AssetSpec } from '@/types';
import { renderAdToCanvas } from '@/lib/canvasRenderer';

interface Props {
  spec:            AssetSpec;
  text:            string;
  subheadline:     string;
  cta:             string;
  showHeadline:    boolean;
  showSubheadline: boolean;
  showCta:         boolean;
  backgroundSrc:   string;
  onClose:         () => void;
}

export function AdLightbox({ spec, text, subheadline, cta, showHeadline, showSubheadline, showCta, backgroundSrc, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Scale ad to fit inside 88vw × 80vh, never upscale beyond spec dimensions
  const maxW  = typeof window !== 'undefined' ? Math.floor(window.innerWidth  * 0.88) : 1200;
  const maxH  = typeof window !== 'undefined' ? Math.floor(window.innerHeight * 0.80) : 900;
  const scale = Math.min(maxW / spec.width, maxH / spec.height, 1);
  const lw    = Math.round(spec.width  * scale);
  const lh    = Math.round(spec.height * scale);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      // Render at lightbox display size; pass original spec dims for correct
      // FORMAT_SPEC lookup and proportional font scaling.
      await renderAdToCanvas(canvas, lw, lh, text, subheadline, cta, showHeadline, showSubheadline, showCta, backgroundSrc, spec.width, spec.height);
    } catch (err) {
      console.error('[AdLightbox] render failed:', err);
    }
  }, [lw, lh, text, subheadline, cta, showHeadline, showSubheadline, showCta, backgroundSrc, spec.width, spec.height]);

  useEffect(() => {
    render();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [render]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ad lightbox"
      onClick={onClose}
      style={{
        alignItems:     'center',
        background:     'rgba(0,0,0,0.88)',
        bottom:         0,
        display:        'flex',
        flexDirection:  'column',
        justifyContent: 'center',
        left:           0,
        position:       'fixed',
        right:          0,
        top:            0,
        zIndex:         1000,
      }}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close lightbox"
        style={{
          background:  'none',
          border:      'none',
          color:       'rgba(255,255,255,0.65)',
          cursor:      'pointer',
          fontSize:    '1.75rem',
          lineHeight:  1,
          padding:     '0.5rem',
          position:    'absolute',
          right:       '1.5rem',
          top:         '1.25rem',
          transition:  'color 120ms ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
      >
        ×
      </button>

      {/* Canvas + label — clicks here don't close the lightbox */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          alignItems:    'center',
          display:       'flex',
          flexDirection: 'column',
          gap:           '0.875rem',
        }}
      >
        <canvas
          ref={canvasRef}
          width={lw}
          height={lh}
          style={{ borderRadius: 3, display: 'block' }}
          aria-label={`${spec.label} full-size preview`}
        />
        <p style={{
          color:         'rgba(255,255,255,0.40)',
          fontSize:      '0.7rem',
          letterSpacing: '0.08em',
          margin:        0,
          textTransform: 'uppercase',
        }}>
          {spec.width} × {spec.height}
        </p>
      </div>
    </div>
  );
}
