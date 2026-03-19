'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { FormatSpec, AppState } from '@/types';
import { renderAd, getRestrictions } from '@/lib/renderAd';
import type { Background } from '@/types';

const MODAL_MAX = 700;

interface Props {
  format:  FormatSpec;
  state:   AppState;
  bgs:     Background[];
  onClose: () => void;
}

export function AdModal({ format, state, bgs, onClose }: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const scale = Math.min(MODAL_MAX / format.w, MODAL_MAX / format.h, 1);
  const dW    = Math.round(format.w * scale);
  const dH    = Math.round(format.h * scale);
  const html  = useMemo(() => renderAd(format, state, bgs), [format, state, bgs]);
  const notes = getRestrictions(format);

  // Close on Escape
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
    const el = innerRef.current;
    if (!el) return;
    // Dynamically import html2canvas to keep it out of initial bundle
    const { default: html2canvas } = await import('html2canvas');
    try {
      const result = await html2canvas(el, {
        scale:           1,
        useCORS:         true,
        allowTaint:      true,
        backgroundColor: null,
        width:           format.w,
        height:          format.h,
        logging:         false,
      });
      const a = document.createElement('a');
      a.download = `fin-ad-${format.w}x${format.h}.png`;
      a.href = result.toDataURL('image/png');
      a.click();
    } catch (e) {
      alert('Export error: ' + (e as Error).message);
    }
  }

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
          background:   '#fff',
          borderRadius: 4,
          maxWidth:     '90vw',
          overflow:     'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '12px 16px',
          borderBottom:   '1px solid rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'SaansMono',monospace", fontSize: 12, fontWeight: 600, letterSpacing: '.05em', color: '#111' }}>
              {format.label}
            </span>
            <span style={{ fontFamily: "'SaansMono',monospace", fontSize: 10, color: 'rgba(0,0,0,0.35)', letterSpacing: '.05em' }}>
              {format.w} × {format.h}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'rgba(0,0,0,0.45)', lineHeight: 1, padding: 4 }}
          >
            ✕
          </button>
        </div>

        {/* Restriction notice */}
        {notes.length > 0 && (
          <div style={{
            padding:    '8px 16px',
            background: '#fff8f0',
            borderBottom: '1px solid rgba(255,86,0,0.15)',
            fontFamily: "'SaansMono',monospace",
            fontSize:   10,
            color:      '#FF5600',
            letterSpacing: '0.04em',
          }}>
            {notes.map(n => '⚠ ' + n).join('\n')}
          </div>
        )}

        {/* Ad — outer clips to display size; inner is full spec pixels for html2canvas */}
        <div style={{ padding: 24, background: '#f0f0ec' }}>
          <div style={{ width: dW, height: dH, position: 'relative', overflow: 'hidden' }}>
            <div
              ref={innerRef}
              style={{
                width:           format.w,
                height:          format.h,
                position:        'absolute',
                top:             0,
                left:            0,
                transform:       `scale(${scale})`,
                transformOrigin: 'top left',
                // Remove transform for html2canvas export; it reads element at its natural size
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding:     '12px 16px',
          borderTop:   '1px solid rgba(0,0,0,0.1)',
          textAlign:   'right',
        }}>
          <button
            onClick={downloadPng}
            style={{
              background:    '#111',
              border:        'none',
              borderRadius:  2,
              color:         '#fff',
              cursor:        'pointer',
              fontFamily:    "'SaansMono',monospace",
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
