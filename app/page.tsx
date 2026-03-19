'use client';

import { useState, useRef, useEffect } from 'react';
import type { AppState, Background } from '@/types';
import { PLATFORMS, ALL_CHANNELS, getAllFormatKeys } from '@/lib/platforms';
import { BACKGROUNDS } from '@/lib/backgrounds';
import { renderAd, wordCount, sanitizeRichHTML, getRestrictions, LOGO_SVG, calcPreviewScale } from '@/lib/renderAd';
import { AdModal } from '@/components/AdModal';
import type { FormatSpec } from '@/types';

const MAX_WORDS     = 10;
const MAX_CTA_WORDS = 4;

function makeInitialState(): AppState {
  return {
    headline: 'Perfect customer experiences are now possible.',
    sub:      'Fin handles the <b>hard stuff</b> so your team doesn\'t have to.',
    cta:      'See how it works',
    bgIdx:    1, // Dark 2
    align:    'center',
    showSub:  false,
    selected: new Set(getAllFormatKeys()),
  };
}

export default function HomePage() {
  const [state, setState]       = useState<AppState>(makeInitialState);
  const [customBg, setCustomBg] = useState<Background | null>(null);
  const [modal, setModal]       = useState<FormatSpec | null>(null);

  const subRef = useRef<HTMLDivElement>(null);

  // Resolved background list (with optional custom upload appended)
  const bgs: Background[] = customBg ? [...BACKGROUNDS, customBg] : BACKGROUNDS;

  // Init contenteditable
  useEffect(() => {
    if (subRef.current) subRef.current.innerHTML = state.sub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── COPY HANDLERS ───────────────────────────────────────────────────────────
  function setHl(raw: string) {
    const words = raw.trim() === '' ? [] : raw.trim().split(/\s+/);
    const clamped = words.length > MAX_WORDS ? words.slice(0, MAX_WORDS).join(' ') : raw;
    setState(s => ({ ...s, headline: clamped }));
    return clamped;
  }

  function syncSub() {
    if (!subRef.current) return;
    const sanitized = sanitizeRichHTML(subRef.current.innerHTML);
    setState(s => ({ ...s, sub: sanitized }));
  }

  function applyBold() {
    subRef.current?.focus();
    document.execCommand('bold', false, undefined);
    syncSub();
  }

  function setCta(raw: string) {
    const words = raw.trim() === '' ? [] : raw.trim().split(/\s+/);
    const clamped = words.length > MAX_CTA_WORDS ? words.slice(0, MAX_CTA_WORDS).join(' ') : raw;
    setState(s => ({ ...s, cta: clamped }));
    return clamped;
  }

  // ── BG / UPLOAD ─────────────────────────────────────────────────────────────
  function setBgIdx(i: number) {
    setState(s => ({ ...s, bgIdx: i }));
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      const custom: Background = { label: 'Custom', v: dataUrl };
      setCustomBg(custom);
      setState(s => ({ ...s, bgIdx: BACKGROUNDS.length })); // last slot
    };
    reader.readAsDataURL(file);
  }

  // ── FORMATS ─────────────────────────────────────────────────────────────────
  function toggleFormat(key: string) {
    setState(s => {
      const next = new Set(s.selected);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...s, selected: next };
    });
  }

  function selectAll(on: boolean) {
    const keys = getAllFormatKeys();
    setState(s => ({ ...s, selected: on ? new Set(keys) : new Set() }));
  }

  // ── RESTRICTIONS ────────────────────────────────────────────────────────────
  const restrictions = modal ? getRestrictions(modal) : [];

  // ── WORD COUNTS ─────────────────────────────────────────────────────────────
  const hlWords  = wordCount(state.headline);
  const subWords = wordCount(state.sub.replace(/<[^>]+>/g, ' '));
  const ctaWords = wordCount(state.cta);

  return (
    <div className="app">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="hdr">
        <div className="hdr-logo" dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />
        <span className="hdr-sep">Ad Generator</span>
        <div style={{ flex: 1 }} />
        <button className="export-btn" onClick={() => {
          if (!modal) alert('Click any format to preview it, then use the Download button.');
        }}>
          ↓ Export PNG
        </button>
      </div>

      <div className="main-layout">

        {/* ── SIDEBAR ───────────────────────────────────────────────────────── */}
        <div className="sidebar">

          {/* Copy */}
          <div className="s-section">
            <div className="s-title">Copy</div>

            {/* Headline */}
            <div className="inp-group">
              <div className="s-row">
                <span className="inp-lbl">Headline</span>
                <span className={'s-count' + (hlWords >= MAX_WORDS - 2 ? ' warn' : '')}>{hlWords} / {MAX_WORDS}</span>
              </div>
              <textarea
                className="inp"
                rows={2}
                placeholder="Perfect customer experiences are now possible."
                value={state.headline}
                onChange={e => {
                  const clamped = setHl(e.target.value);
                  if (clamped !== e.target.value) e.target.value = clamped;
                }}
              />
              {hlWords >= MAX_WORDS && <div className="inp-warn" style={{ display: 'block' }}>{MAX_WORDS} word maximum</div>}
            </div>

            {/* Subheadline */}
            <div className="inp-group">
              <div className="s-row">
                <span className="inp-lbl">Subheadline</span>
                <span className={'s-count' + (subWords >= MAX_WORDS - 2 ? ' warn' : '')}>{subWords} / {MAX_WORDS}</span>
              </div>
              <div
                ref={subRef}
                contentEditable
                suppressContentEditableWarning
                className="inp rich-input"
                data-placeholder="Your subheadline here"
                data-field="sub"
                onInput={syncSub}
              />
              {subWords >= MAX_WORDS && <div className="inp-warn" style={{ display: 'block' }}>{MAX_WORDS} word maximum</div>}
              <div className="bold-toolbar" style={{ marginTop: 6 }}>
                <button
                  className="bold-btn"
                  onMouseDown={e => { e.preventDefault(); applyBold(); }}
                  title="Bold selected text"
                >
                  B
                </button>
              </div>
            </div>

            {/* Show subheadline toggle */}
            <div className="inp-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className="inp-lbl">Show subheadline</span>
              <div
                style={{ position: 'relative', width: 30, height: 16, cursor: 'pointer' }}
                onClick={() => setState(s => ({ ...s, showSub: !s.showSub }))}
              >
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 8,
                  background: state.showSub ? '#FF5600' : 'rgba(0,0,0,0.15)',
                  transition: 'background .15s',
                }} id="sub-track" />
                <div style={{
                  position: 'absolute', top: 2, left: 2, width: 12, height: 12,
                  borderRadius: '50%', background: '#fff',
                  transition: 'transform .15s',
                  transform: state.showSub ? 'translateX(14px)' : 'translateX(0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} id="sub-thumb" />
              </div>
            </div>

            {/* CTA */}
            <div className="inp-group">
              <div className="s-row">
                <span className="inp-lbl">CTA</span>
                <span className={'s-count' + (ctaWords >= MAX_CTA_WORDS ? ' warn' : '')}>{ctaWords} / {MAX_CTA_WORDS}</span>
              </div>
              <input
                className="inp"
                type="text"
                value={state.cta}
                onChange={e => {
                  const clamped = setCta(e.target.value);
                  if (clamped !== e.target.value) e.target.value = clamped;
                }}
              />
              {ctaWords >= MAX_CTA_WORDS && <div className="inp-warn" style={{ display: 'block' }}>{MAX_CTA_WORDS} word maximum</div>}
            </div>

            {/* Restriction notice */}
            {restrictions.length > 0 && (
              <div className="restriction-notice">
                {restrictions.map(n => '⚠ ' + n).join('\n')}
              </div>
            )}
          </div>

          {/* Background */}
          <div className="s-section">
            <div className="s-title">Background</div>
            <div className="bg-grid">
              {bgs.map((bg, i) => (
                <div
                  key={i}
                  className={'bg-sw' + (i === state.bgIdx ? ' active' : '')}
                  title={bg.label}
                  style={bg.v.startsWith('solid:')
                    ? {
                        background: bg.v.replace('solid:', ''),
                        ...(bg.v.includes('0A0A0A') ? { border: '2px solid rgba(0,0,0,.2)' } : {}),
                      }
                    : { backgroundImage: `url(${bg.v})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  }
                  onClick={() => setBgIdx(i)}
                />
              ))}
            </div>
            <label className="upload-lbl">
              Upload image
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
            </label>
          </div>

          {/* Alignment */}
          <div className="s-section">
            <div className="s-title">Alignment</div>
            <div className="tc-row">
              <div
                className={'tc-chip dark' + (state.align === 'left' ? ' active' : '')}
                onClick={() => setState(s => ({ ...s, align: 'left' }))}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}
                title="Left align"
              >
                <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                  <rect y="0" width="14" height="1.5" fill="currentColor"/>
                  <rect y="3" width="10" height="1.5" fill="currentColor"/>
                  <rect y="6" width="14" height="1.5" fill="currentColor"/>
                  <rect y="9" width="8"  height="1.5" fill="currentColor"/>
                </svg>
              </div>
              <div
                className={'tc-chip light' + (state.align === 'center' ? ' active' : '')}
                onClick={() => setState(s => ({ ...s, align: 'center' }))}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}
                title="Center align"
              >
                <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                  <rect y="0"  width="14" height="1.5" fill="currentColor"/>
                  <rect x="2" y="3"  width="10" height="1.5" fill="currentColor"/>
                  <rect y="6"  width="14" height="1.5" fill="currentColor"/>
                  <rect x="3" y="9"  width="8"  height="1.5" fill="currentColor"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Formats */}
          <div className="s-section">
            <div className="s-title">Formats</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {(['Select all', 'Deselect all'] as const).map((label, i) => (
                <button
                  key={label}
                  onClick={() => selectAll(i === 0)}
                  style={{
                    flex: 1, fontFamily: "'SaansMono',monospace", fontSize: 9,
                    letterSpacing: '.08em', textTransform: 'uppercase', padding: '6px 4px',
                    borderRadius: 2, border: '1px solid rgba(0,0,0,0.15)',
                    background: '#fff', color: '#111', cursor: 'pointer',
                  }}
                  onMouseOver={e => { (e.currentTarget).style.borderColor = '#FF5600'; (e.currentTarget).style.color = '#FF5600'; }}
                  onMouseOut={e => { (e.currentTarget).style.borderColor = 'rgba(0,0,0,0.15)'; (e.currentTarget).style.color = '#111'; }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div>
              {ALL_CHANNELS.map(platform => (
                <div key={platform}>
                  <div className="fmt-group-lbl">{platform}</div>
                  <div className="fmt-checks">
                    {PLATFORMS[platform].map(f => {
                      const key = platform + '_' + f.label;
                      const checked = state.selected.has(key);
                      return (
                        <label key={key} className={'fmt-check' + (checked ? ' checked' : '')}>
                          <input type="checkbox" checked={checked} onChange={() => toggleFormat(key)} />
                          <div className="box" />
                          <span className="fmt-lbl">{f.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>{/* /sidebar */}

        {/* ── PREVIEW GRID ────────────────────────────────────────────────── */}
        <div id="all-grid">
          {ALL_CHANNELS.map(platform => {
            const active = PLATFORMS[platform].filter(f => state.selected.has(platform + '_' + f.label));
            if (!active.length) return null;
            return (
              <div key={platform} className="fmt-platform-block">
                <div className="fmt-platform-title">{platform}</div>
                <div className="fmt-row">
                  {active.map(f => (
                    <AdPreviewCard
                      key={platform + '_' + f.label}
                      format={f}
                      state={state}
                      bgs={bgs}
                      onClick={() => setModal(f)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

      </div>{/* /main-layout */}

      {/* ── MODAL ───────────────────────────────────────────────────────────── */}
      {modal && (
        <AdModal
          format={modal}
          state={state}
          bgs={bgs}
          onClose={() => setModal(null)}
        />
      )}

    </div>
  );
}

// ─── PREVIEW CARD ─────────────────────────────────────────────────────────────
function AdPreviewCard({
  format, state, bgs, onClick,
}: {
  format: FormatSpec;
  state:  AppState;
  bgs:    Background[];
  onClick: () => void;
}) {
  const scale = calcPreviewScale(format.w, format.h);
  const dW    = Math.round(format.w * scale);
  const dH    = Math.round(format.h * scale);
  const html  = renderAd(format, state, bgs);

  return (
    <div className="ad-preview-wrap" title="Click to preview" onClick={onClick}>
      <div className="ad-frame" style={{ width: dW, height: dH }}>
        <div
          className="ad-inner"
          style={{ width: format.w, height: format.h, transform: `scale(${scale})` }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
      <div className="ad-lbl">{format.label}</div>
    </div>
  );
}
