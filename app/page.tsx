'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { AppState, Background } from '@/types';
import { PLATFORMS, ALL_CHANNELS, getAllFormatKeys } from '@/lib/platforms';
import { BACKGROUNDS } from '@/lib/backgrounds';
import { renderAd, sanitizeRichHTML, getRestrictions, LOGO_SVG, calcPreviewScale } from '@/lib/renderAd';
import { AdModal } from '@/components/AdModal';
import { downloadAll } from '@/lib/downloadAll';
import type { FormatSpec } from '@/types';

const MAX_CHARS     = 60;
const MAX_CTA_WORDS = 4;

// ─── WCAG 7:1 CONTRAST HELPERS ────────────────────────────────────────────────
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function getLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
// Luminance of text colour #FAF9F6
const TEXT_LUM = getLuminance(250, 249, 246);
// Min bg luminance for 7:1 contrast against TEXT_LUM
const TARGET_BG_LUM = (TEXT_LUM + 0.05) / 7 - 0.05;

function calcMinOpacity(avgR: number, avgG: number, avgB: number): number {
  const bgLum = getLuminance(avgR, avgG, avgB);
  if (bgLum <= TARGET_BG_LUM) return 0;
  // Binary-search minimum black overlay opacity so darkened bg meets contrast
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const f = 1 - mid;
    const lum = getLuminance(avgR * f, avgG * f, avgB * f);
    if (lum <= TARGET_BG_LUM) hi = mid; else lo = mid;
  }
  return Math.ceil(hi * 100); // return as integer percentage, rounded up
}

async function sampleBgMinOpacity(bg: Background): Promise<number> {
  if (bg.v.startsWith('solid:')) {
    const hex = bg.v.replace('solid:', '').replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return calcMinOpacity(r, g, b);
  }
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 64, 64);
      const data = ctx.getImageData(0, 0, 64, 64).data;
      let r = 0, g = 0, b = 0;
      const n = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]; g += data[i + 1]; b += data[i + 2];
      }
      resolve(calcMinOpacity(r / n, g / n, b / n));
    };
    img.onerror = () => resolve(0);
    img.src = bg.v;
  });
}

// ─── INITIAL STATE ────────────────────────────────────────────────────────────
function makeInitialState(): AppState {
  return {
    headline: 'Perfect customer experiences are now possible.',
    sub:      'Fin handles the <b>hard stuff</b> so your team doesn\'t have to.',
    cta:      'See how it works',
    bgIdx:           1, // Dark 2
    align:           'center',
    showSub:         false,
    selected:        new Set(getAllFormatKeys()),
    campaign:        '',
    overlayOpacity:  0,
    formatOverrides: {},
  };
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [state, setState]         = useState<AppState>(makeInitialState);
  const [customBg, setCustomBg]   = useState<Background | null>(null);
  const [modal, setModal]         = useState<FormatSpec | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const [minOverlay, setMinOverlay] = useState(0);
  const [dlProgress, setDlProgress] = useState<{ done: number; total: number } | null>(null);

  const subRef = useRef<HTMLDivElement>(null);

  // Resolved background list (with optional custom upload appended)
  const bgs: Background[] = customBg ? [...BACKGROUNDS, customBg] : BACKGROUNDS;

  // ── FONT READINESS: re-render all preview cards once fonts load ────────────
  useEffect(() => {
    document.fonts.ready.then(() => setRenderKey(k => k + 1));
  }, []);

  // Init contenteditable sub field
  useEffect(() => {
    if (subRef.current) subRef.current.innerHTML = state.sub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── WCAG MIN OVERLAY: recalculate when bg changes ─────────────────────────
  useEffect(() => {
    const bg = bgs[state.bgIdx] || bgs[0];
    sampleBgMinOpacity(bg).then(setMinOverlay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.bgIdx, bgs.length]);

  // ── COPY HANDLERS ─────────────────────────────────────────────────────────
  function setHl(raw: string) {
    const clamped = raw.slice(0, MAX_CHARS);
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

  // ── BG / UPLOAD ───────────────────────────────────────────────────────────
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
      setState(s => ({ ...s, bgIdx: BACKGROUNDS.length }));
    };
    reader.readAsDataURL(file);
  }

  // ── FORMATS ───────────────────────────────────────────────────────────────
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

  // ── FORMAT OVERRIDES ──────────────────────────────────────────────────────
  const handleOverride = useCallback((key: string, field: 'hl' | 'cta', value: string) => {
    setState(s => ({
      ...s,
      formatOverrides: {
        ...s.formatOverrides,
        [key]: {
          ...s.formatOverrides[key],
          [field]: value || undefined,
        },
      },
    }));
  }, []);

  // ── DOWNLOAD ALL ──────────────────────────────────────────────────────────
  async function handleDownloadAll() {
    if (!state.campaign.trim() || dlProgress !== null) return;
    try {
      setDlProgress({ done: 0, total: 0 });
      await downloadAll(state, bgs, (done, total) => setDlProgress({ done, total }));
    } catch (e) {
      alert('Download error: ' + (e as Error).message);
    } finally {
      setDlProgress(null);
    }
  }

  // ── RESTRICTIONS (shown in sidebar when modal is open) ────────────────────
  const restrictions = modal ? getRestrictions(modal) : [];

  // ── CHAR / WORD COUNTS ────────────────────────────────────────────────────
  const hlChars  = state.headline.length;
  const subChars = state.sub.replace(/<[^>]+>/g, '').length;
  const ctaWords = state.cta.trim() === '' ? 0 : state.cta.trim().split(/\s+/).length;

  const isDownloading = dlProgress !== null;
  const canDownload   = !!state.campaign.trim() && !isDownloading;
  const dlLabel = isDownloading
    ? (dlProgress!.total > 0
        ? `Exporting ${dlProgress!.done} / ${dlProgress!.total}…`
        : 'Preparing…')
    : '↓ Download All';

  return (
    <div className="app">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="hdr">
        <div className="hdr-logo" dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />
        <span className="hdr-sep">Performance Marketing Ad Generator</span>
      </div>

      <div className="main-layout">

        {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
        <div className="sidebar">

          {/* Campaign title — mandatory, unlocks Download All */}
          <div className="s-section" style={{ paddingBottom: 0 }}>
            <input
              className="inp"
              type="text"
              placeholder="Campaign title"
              value={state.campaign}
              onChange={e => setState(s => ({ ...s, campaign: e.target.value }))}
              style={{ marginBottom: 10 }}
            />
            <button
              onClick={handleDownloadAll}
              disabled={!canDownload}
              style={{
                width:         '100%',
                fontFamily:    "'SaansMono',monospace",
                fontSize:      10,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                padding:       '9px 4px',
                borderRadius:  2,
                border:        'none',
                background:    canDownload ? '#111' : 'rgba(0,0,0,0.12)',
                color:         canDownload ? '#fff' : 'rgba(0,0,0,0.3)',
                cursor:        canDownload ? 'pointer' : 'not-allowed',
                marginBottom:  16,
                transition:    'background .15s, color .15s',
              }}
            >
              {dlLabel}
            </button>
          </div>

          {/* Copy */}
          <div className="s-section">
            <div className="s-title">Copy</div>

            {/* Headline */}
            <div className="inp-group">
              <div className="s-row">
                <span className="inp-lbl">Headline</span>
                <span className={'s-count' + (hlChars >= MAX_CHARS - 5 ? ' warn' : '')}>{hlChars} / {MAX_CHARS} chars</span>
              </div>
              <textarea
                className="inp"
                rows={2}
                placeholder="Perfect customer experiences are now possible."
                value={state.headline}
                onChange={e => {
                  const clamped = e.target.value.slice(0, MAX_CHARS);
                  setState(s => ({ ...s, headline: clamped }));
                  if (clamped !== e.target.value) e.target.value = clamped;
                }}
              />
              {hlChars >= MAX_CHARS && <div className="inp-warn" style={{ display: 'block' }}>{MAX_CHARS} character maximum</div>}
            </div>

            {/* Subheadline */}
            <div className="inp-group">
              <div className="s-row">
                <span className="inp-lbl">Subheadline</span>
                <span className={'s-count' + (subChars >= MAX_CHARS - 5 ? ' warn' : '')}>{subChars} / {MAX_CHARS} chars</span>
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
              {subChars >= MAX_CHARS && <div className="inp-warn" style={{ display: 'block' }}>{MAX_CHARS} character maximum</div>}
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
                }} />
                <div style={{
                  position: 'absolute', top: 2, left: 2, width: 12, height: 12,
                  borderRadius: '50%', background: '#fff',
                  transition: 'transform .15s',
                  transform: state.showSub ? 'translateX(14px)' : 'translateX(0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
            </div>

            {/* CTA */}
            <div className="inp-group">
              <div className="s-row">
                <span className="inp-lbl">CTA</span>
                <span className={'s-count' + (ctaWords >= MAX_CTA_WORDS ? ' warn' : '')}>{ctaWords} / {MAX_CTA_WORDS} words</span>
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

            {/* Darkness overlay slider */}
            <div style={{ marginTop: 14 }}>
              <div className="s-row" style={{ marginBottom: 6 }}>
                <span className="inp-lbl">Darkness overlay</span>
                <span className={'s-count' + (state.overlayOpacity < minOverlay && minOverlay > 0 ? ' warn' : '')}>
                  {state.overlayOpacity}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={state.overlayOpacity}
                onChange={e => setState(s => ({ ...s, overlayOpacity: Number(e.target.value) }))}
                style={{ width: '100%', accentColor: '#FF5600', cursor: 'pointer' }}
              />
              {state.overlayOpacity < minOverlay && minOverlay > 0 && (
                <div className="inp-warn" style={{ display: 'block', marginTop: 4 }}>
                  ⚠ Needs {minOverlay}%+ for WCAG AAA (7:1) contrast
                </div>
              )}
            </div>
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
                      const key = f._platformKey || platform + '_' + f.label;
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
            const active = PLATFORMS[platform].filter(f => {
              const key = f._platformKey || platform + '_' + f.label;
              return state.selected.has(key);
            });
            if (!active.length) return null;
            return (
              <div key={platform} className="fmt-platform-block">
                <div className="fmt-platform-title">{platform}</div>
                <div className="fmt-row">
                  {active.map(f => (
                    <AdPreviewCard
                      key={(f._platformKey || platform + '_' + f.label) + '_' + renderKey}
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
          onOverride={handleOverride}
        />
      )}

    </div>
  );
}

// ─── PREVIEW CARD ─────────────────────────────────────────────────────────────
function AdPreviewCard({
  format, state, bgs, onClick,
}: {
  format:  FormatSpec;
  state:   AppState;
  bgs:     Background[];
  onClick: () => void;
}) {
  const key          = format._platformKey || '';
  const overrideData = key ? (state.formatOverrides[key] || {}) : {};
  const effectiveState: AppState = {
    ...state,
    headline: overrideData.hl || state.headline,
    cta:      overrideData.cta || state.cta,
  };

  const scale = calcPreviewScale(format.w, format.h);
  const dW    = Math.round(format.w * scale);
  const dH    = Math.round(format.h * scale);
  const html  = renderAd(format, effectiveState, bgs);

  return (
    <div className="ad-preview-wrap" title="Click to preview" onClick={onClick}>
      <div className="ad-frame" style={{ width: dW, height: dH }}>
        <div
          className="ad-inner"
          data-format-key={key}
          style={{ width: format.w, height: format.h, transform: `scale(${scale})` }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
      <div className="ad-lbl">{format.label}</div>
    </div>
  );
}
