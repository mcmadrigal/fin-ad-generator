'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormatSpec, AppState, Background } from '@/types';
import { renderAd, getRestrictions } from '@/lib/renderAd';

const MODAL_MAX = 700;

interface Props {
  format:     FormatSpec;
  state:      AppState;
  bgs:        Background[];
  onClose:    () => void;
  onOverride: (key: string, field: 'hl' | 'cta', value: string) => void;
}

export function AdModal({ format, state, bgs, onClose, onOverride }: Props) {
  const innerRef             = useRef<HTMLDivElement>(null);
  const [fullSize, setFullSize] = useState(false);

  const key         = format._platformKey || '';
  const overrideData = key ? (state.formatOverrides[key] || {}) : {};

  const scale = fullSize ? 1 : Math.min(MODAL_MAX / format.w, MODAL_MAX / format.h, 1);
  const dW    = fullSize ? format.w : Math.round(format.w * scale);
  const dH    = fullSize ? format.h : Math.round(format.h * scale);

  const html = useMemo(() => {
    const effectiveState: AppState = {
      ...state,
      headline: overrideData.hl || state.headline,
      cta:      overrideData.cta || state.cta,
    };
    return renderAd(format, effectiveState, bgs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, state, bgs]);

  const notes = getRestrictions(format);

  // Close on Escape; reset fullSize on unmount
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  async function downloadPng() {
    const { renderAdHTML } = await import('@/lib/renderAd');
    try {
      const effectiveState: AppState = {
        ...state,
        headline: overrideData.hl  || state.headline,
        cta:      overrideData.cta || state.cta,
      };
      const html = await renderAdHTML(format, effectiveState, bgs);
      const res  = await fetch('/api/capture', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ html, width: format.w, height: format.h }),
      });
      if (!res.ok) throw new Error(res.statusText);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.download = `${state.campaign || 'fin-ad'}_${format.label}.png`;
      a.href     = url;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export error: ' + (e as Error).message);
    }
  }

  // ── STYLE HELPERS ──────────────────────────────────────────────────────────
  const monoStyle: React.CSSProperties = { fontFamily: "'SaansMono',monospace" };
  const sansStyle: React.CSSProperties = { fontFamily: "'Saans',sans-serif" };

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.72)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        zIndex:         1000,
        padding:        '2rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background:    '#fff',
          borderRadius:  4,
          maxWidth:      '92vw',
          maxHeight:     '92vh',
          overflow:      'hidden',
          display:       'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '12px 16px',
          borderBottom:   '1px solid rgba(0,0,0,0.1)',
          flexShrink:     0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...monoStyle, fontSize: 12, fontWeight: 600, letterSpacing: '.05em', color: '#111' }}>
              {format.label}
            </span>
            <span style={{ ...monoStyle, fontSize: 10, color: 'rgba(0,0,0,0.35)', letterSpacing: '.05em' }}>
              {format.w} × {format.h}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 100% toggle */}
            <button
              onClick={() => setFullSize(v => !v)}
              style={{
                background:    fullSize ? '#111' : 'transparent',
                border:        '1px solid rgba(0,0,0,0.2)',
                borderRadius:  2,
                cursor:        'pointer',
                ...monoStyle,
                fontSize:      9,
                letterSpacing: '.05em',
                color:         fullSize ? '#fff' : '#555',
                padding:       '4px 10px',
                textTransform: 'uppercase',
              }}
            >
              {fullSize ? '↙ Fit' : '↗ 100%'}
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'rgba(0,0,0,0.45)', lineHeight: 1, padding: 4 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── RESTRICTION NOTICE ───────────────────────────────────────────── */}
        {notes.length > 0 && (
          <div style={{
            padding:      '8px 16px',
            background:   '#fff8f0',
            borderBottom: '1px solid rgba(255,86,0,0.15)',
            ...monoStyle,
            fontSize:     10,
            color:        '#FF5600',
            letterSpacing:'0.04em',
            flexShrink:   0,
          }}>
            {notes.map(n => '⚠ ' + n).join('\n')}
          </div>
        )}

        {/* ── AD PREVIEW ───────────────────────────────────────────────────── */}
        <div style={{
          padding:    24,
          background: '#f0f0ec',
          overflow:   'auto',
          flexShrink: 0,
          maxHeight:  fullSize ? '60vh' : 'none',
        }}>
          <div style={{ width: dW, height: dH, position: 'relative', overflow: 'hidden' }}>
            <div
              ref={innerRef}
              data-format-key="modal-render"
              style={{
                width:           format.w,
                height:          format.h,
                position:        'absolute',
                top:             0,
                left:            0,
                transform:       fullSize ? 'none' : `scale(${scale})`,
                transformOrigin: 'top left',
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>

        {/* ── FORMAT OVERRIDES ─────────────────────────────────────────────── */}
        {key && (
          <div style={{
            padding:     '12px 16px',
            borderTop:   '1px solid rgba(0,0,0,0.08)',
            background:  '#fafaf8',
            flexShrink:  0,
          }}>
            <div style={{ ...monoStyle, fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.38)', marginBottom: 8 }}>
              Format overrides
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: 160 }}>
                <div style={{ ...monoStyle, fontSize: 9, color: 'rgba(0,0,0,0.38)', letterSpacing: '.05em', marginBottom: 4 }}>HEADLINE</div>
                <input
                  type="text"
                  placeholder={state.headline}
                  value={overrideData.hl ?? ''}
                  onChange={e => onOverride(key, 'hl', e.target.value)}
                  style={{
                    width:       '100%',
                    ...sansStyle,
                    fontSize:    12,
                    padding:     '6px 8px',
                    border:      '1px solid rgba(0,0,0,0.15)',
                    borderRadius:2,
                    background:  '#fff',
                    color:       '#111',
                    boxSizing:   'border-box',
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ ...monoStyle, fontSize: 9, color: 'rgba(0,0,0,0.38)', letterSpacing: '.05em', marginBottom: 4 }}>CTA</div>
                <input
                  type="text"
                  placeholder={state.cta}
                  value={overrideData.cta ?? ''}
                  onChange={e => onOverride(key, 'cta', e.target.value)}
                  style={{
                    width:       '100%',
                    ...sansStyle,
                    fontSize:    12,
                    padding:     '6px 8px',
                    border:      '1px solid rgba(0,0,0,0.15)',
                    borderRadius:2,
                    background:  '#fff',
                    color:       '#111',
                    boxSizing:   'border-box',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── FOOTER ───────────────────────────────────────────────────────── */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.1)', textAlign: 'right', flexShrink: 0 }}>
          <button
            onClick={downloadPng}
            style={{
              background:    '#111',
              border:        'none',
              borderRadius:  2,
              color:         '#fff',
              cursor:        'pointer',
              ...monoStyle,
              fontSize:      10,
              letterSpacing: '.08em',
              padding:       '8px 18px',
              textTransform: 'uppercase',
            }}
          >
            ↓ Download PNG
          </button>
        </div>
      </div>
    </div>
  );
}
