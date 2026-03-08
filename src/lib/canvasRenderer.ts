/**
 * Core canvas rendering engine for Fin ad generator.
 * All rendering is client-side; this file must only be imported from client components.
 *
 * Background  : cover-fit image + rgba(10,14,26,0.50) dark overlay
 * Typography  : hardcoded per-format type specs — no dynamic scaling
 * Layout      : vertical thirds | horizontal (banner)
 * CTA         : all-caps tracked text + thin underline rule — no button
 */

import { wrapText, wrapPortraitText, textBlockHeight } from './textLayout';

// ---------------------------------------------------------------------------
// Fin logo — viewBox="0 0 556 196", natural aspect ≈ 2.837
// ---------------------------------------------------------------------------
const LOGO_ASPECT = 556 / 196;

let _logoPromise: Promise<HTMLImageElement> | null = null;

function loadLogoImage(): Promise<HTMLImageElement> {
  if (_logoPromise) return _logoPromise;
  _logoPromise = fetch('/logos/lockup_white.svg')
    .then(r => r.text())
    .then(svgText => new Promise<HTMLImageElement>((resolve, reject) => {
      const img  = new Image();
      const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Logo load failed')); };
      img.src = url;
    }));
  return _logoPromise;
}

// ---------------------------------------------------------------------------
// Background image cache
// ---------------------------------------------------------------------------
const _bgCache = new Map<string, HTMLImageElement>();

function loadBgImage(src: string): Promise<HTMLImageElement> {
  if (_bgCache.has(src)) return Promise.resolve(_bgCache.get(src)!);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => { _bgCache.set(src, img); resolve(img); };
    img.onerror = () => reject(new Error(`Failed to load background: ${src}`));
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// Brand font stacks
// ---------------------------------------------------------------------------
const HEADLINE_FONT_STACK = "'Ivory LL', Georgia, 'Times New Roman', serif";
const CTA_FONT_STACK      = "'Medium LL TT', 'Medium LL', -apple-system, sans-serif";

function headlineFont(size: number): string { return `300 ${size}px ${HEADLINE_FONT_STACK}`; }
function ctaFont(size: number):     string  { return `400 ${size}px ${CTA_FONT_STACK}`; }

// ---------------------------------------------------------------------------
// ctx.letterSpacing helper (Chrome 99+, Safari 17+)
// ---------------------------------------------------------------------------
function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number): void {
  try { (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`; }
  catch { /* noop */ }
}

// ---------------------------------------------------------------------------
// Per-format type specs — all values hardcoded at spec size, scaled at render
// ---------------------------------------------------------------------------
interface FormatSpec {
  headlinePx:          number;
  ctaPx:               number | null;
  logoH:               number;
  layout:              'vertical' | 'horizontal';
  headLS:              number;   // headline letter-spacing as fraction of headlinePx
  headLH:              number;   // headline line-height as fraction of headlinePx
  // Optional overrides
  maxWordsPerLine?:    number;   // word-count wrap; omit = pixel-based (or portrait default 4)
  padXSpec?:           number;   // override horizontal padding at spec size
  autoShrinkHeadline?: boolean;  // shrink font to fit (horizontal only), no truncation
  headlineFloorPx?:    number;   // minimum headlinePx for auto-shrink, at spec size
  layoutStyle?:        'poster'; // editorial: logo top, large headline center, CTA footnote bottom
  textAlign?:          'left' | 'center'; // poster alignment; default: left for W≥H, center for H>W
}

const FORMAT_SPECS: Record<string, FormatSpec> = {
  // TTD
  // 300×250 is the reference — no override flags
  '160x600':   { headlinePx: 80,  ctaPx: 10,    logoH: 14,  layout: 'vertical',   headLS: -0.03, headLH: 0.95, maxWordsPerLine: 2, padXSpec: 20, layoutStyle: 'poster', textAlign: 'center' },
  '300x250':   { headlinePx: 80,  ctaPx: 7,     logoH: 14,  layout: 'vertical',   headLS: -0.06, headLH: 1.00, maxWordsPerLine: 2, layoutStyle: 'poster', textAlign: 'left' },
  '728x90':    { headlinePx: 18,  ctaPx: 10,    logoH: 20,  layout: 'horizontal', headLS: -0.03, headLH: 0.95 },
  '300x600':   { headlinePx: 120, ctaPx: 10,    logoH: 18,  layout: 'vertical',   headLS: -0.06, headLH: 1.00, maxWordsPerLine: 3, layoutStyle: 'poster', textAlign: 'center' },
  '320x50':    { headlinePx: 15,  ctaPx: 9,     logoH: 14,  layout: 'horizontal', headLS: -0.03, headLH: 0.95, autoShrinkHeadline: true, headlineFloorPx: 9 },
  '300x50':    { headlinePx: 15,  ctaPx: 9,     logoH: 14,  layout: 'horizontal', headLS: -0.03, headLH: 0.95, autoShrinkHeadline: true, headlineFloorPx: 9 },
  '768x1024':  { headlinePx: 160, ctaPx: 13,    logoH: 20,  layout: 'vertical',   headLS: -0.06, headLH: 1.00, maxWordsPerLine: 4, layoutStyle: 'poster', textAlign: 'center' },
  '1024x768':  { headlinePx: 160, ctaPx: 13,    logoH: 28,  layout: 'vertical',   headLS: -0.06, headLH: 1.00, maxWordsPerLine: 4, layoutStyle: 'poster', textAlign: 'left' },
  '320x480':   { headlinePx: 100, ctaPx: 10,    logoH: 16,  layout: 'vertical',   headLS: -0.06, headLH: 0.95, maxWordsPerLine: 3, layoutStyle: 'poster', textAlign: 'center' },
  '970x250':   { headlinePx: 25,  ctaPx: 11,    logoH: 26,  layout: 'horizontal', headLS: -0.03, headLH: 0.95 },
  '480x320':   { headlinePx: 100, ctaPx: 10,    logoH: 18,  layout: 'vertical',   headLS: -0.06, headLH: 1.00, maxWordsPerLine: 3, layoutStyle: 'poster', textAlign: 'left' },
  // LinkedIn (+30% headline, max 4 words/line)
  '1080x1080': { headlinePx: 220, ctaPx: 11,    logoH: 36,  layout: 'vertical',   headLS: -0.06, headLH: 1.00, maxWordsPerLine: 3, layoutStyle: 'poster', textAlign: 'left' },
  '1200x1200': { headlinePx: 240, ctaPx: 12,    logoH: 40,  layout: 'vertical',   headLS: -0.06, headLH: 1.00, maxWordsPerLine: 3, layoutStyle: 'poster', textAlign: 'left' },
  // 6Sense
  '1200x628':  { headlinePx: 160, ctaPx: 11,    logoH: 28,  layout: 'vertical',   headLS: -0.06, headLH: 1.00, maxWordsPerLine: 4, layoutStyle: 'poster', textAlign: 'left' },
  // Meta
  // 1080×1080 shared with LinkedIn above
  '1080x1920': { headlinePx: 300, ctaPx: 13,    logoH: 36,  layout: 'vertical',   headLS: -0.06, headLH: 1.00, maxWordsPerLine: 3, layoutStyle: 'poster', textAlign: 'center' },
  '1920x1080': { headlinePx: 200, ctaPx: 13,    logoH: 40,  layout: 'vertical',   headLS: -0.03, headLH: 0.95, maxWordsPerLine: 4, layoutStyle: 'poster', textAlign: 'left' },
};

function getSpec(W: number, H: number): FormatSpec {
  return FORMAT_SPECS[`${W}x${H}`] ?? {
    headlinePx: Math.max(12, Math.min(W, H) * 0.06),
    ctaPx:      Math.max(9,  Math.min(W, H) * 0.025),
    logoH:      Math.max(14, Math.min(W, H) * 0.05),
    layout:     W > H * 2 ? 'horizontal' : 'vertical',
    headLS:     W > H * 2 ? -0.03 : -0.06,
    headLH:     1.00,
  };
}

// ---------------------------------------------------------------------------
// Background: cover-fit + deep navy overlay
// ---------------------------------------------------------------------------
function drawCoverBackground(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  img: HTMLImageElement,
): void {
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth  * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  ctx.fillStyle = 'rgba(10,14,26,0.50)';
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Renders a Fin ad to the given canvas at the requested pixel dimensions.
 *
 * specWidth / specHeight are the original ad spec dimensions used for the
 * FORMAT_SPECS lookup and portrait detection. Pass them when rendering at a
 * scaled-down preview size. Omit when rendering at the true spec size.
 */
export async function renderAdToCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  text: string,
  cta: string,
  backgroundSrc: string,
  specWidth?: number,
  specHeight?: number,
): Promise<void> {
  canvas.width  = Math.round(width);
  canvas.height = Math.round(height);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const W = canvas.width;
  const H = canvas.height;

  // 1. Background image + overlay
  const bgImg = await loadBgImage(backgroundSrc);
  drawCoverBackground(ctx, W, H, bgImg);

  // 2. Wait for fonts
  if (typeof document !== 'undefined') await document.fonts.ready;

  // 3. Load logo
  const logoImg = await loadLogoImage();

  // 4. Resolve spec using original dimensions, scale all size values to display
  const sW = specWidth  ?? W;
  const sH = specHeight ?? H;
  const rawSpec   = getSpec(sW, sH);
  const dispScale = Math.min(W / sW, H / sH);

  const spec: FormatSpec = {
    ...rawSpec,
    headlinePx:      rawSpec.headlinePx   * dispScale,
    ctaPx:           rawSpec.ctaPx !== null ? rawSpec.ctaPx * dispScale : null,
    logoH:           rawSpec.logoH        * dispScale,
    padXSpec:        rawSpec.padXSpec        !== undefined ? rawSpec.padXSpec        * dispScale : undefined,
    headlineFloorPx: rawSpec.headlineFloorPx !== undefined ? rawSpec.headlineFloorPx * dispScale : undefined,
  };

  // Portrait = spec taller than wide (use spec dims, not display dims)
  const isPortrait = sH > sW;

  // 5. Route to layout
  if (spec.layoutStyle === 'poster') {
    renderPosterLayout(ctx, W, H, text, cta, logoImg, spec, isPortrait);
  } else if (spec.layout === 'horizontal') {
    renderHorizontalLayout(ctx, W, H, text, cta, logoImg, spec);
  } else {
    renderVerticalLayout(ctx, W, H, text, cta, logoImg, spec, isPortrait);
  }
}

// ---------------------------------------------------------------------------
// Vertical layout — logo top third | headline middle third | CTA bottom third
// ---------------------------------------------------------------------------
function renderVerticalLayout(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  text: string, cta: string,
  logoImg: HTMLImageElement,
  spec: FormatSpec,
  isPortrait: boolean,
): void {
  // padXSpec overrides the default 8% when a minimum pixel margin is required
  const padX     = spec.padXSpec !== undefined ? spec.padXSpec : W * 0.08;
  const padY     = H * 0.08;
  const contentH = H - padY * 2;
  const thirdH   = contentH / 3;

  // ── Logo (top third, centered, natural aspect ratio) ──────────────────────
  const rawLogoW = spec.logoH * LOGO_ASPECT;
  const logoW    = Math.min(rawLogoW, W - padX * 2);
  const logoH    = logoW / LOGO_ASPECT;
  ctx.drawImage(logoImg, (W - logoW) / 2, padY + (thirdH - logoH) / 2, logoW, logoH);

  // ── CTA (bottom third, anchored near bottom edge) ─────────────────────────
  if (spec.ctaPx !== null) {
    const ruleH   = Math.max(0.5, spec.ctaPx * 0.05);
    const ruleGap = Math.max(1,   spec.ctaPx * 0.15);
    const ctaY    = H - padY - spec.ctaPx - ruleGap - ruleH;
    drawCTACentered(ctx, W, cta, spec.ctaPx, ctaY, ruleH, ruleGap);
  }

  // ── Headline (middle third, centered) ─────────────────────────────────────
  let headlinePx = spec.headlinePx;   // mutable — may be reduced for overflow
  const { headLS, headLH } = spec;
  const maxW   = W - padX * 2;
  const midTop = padY + thirdH;
  const midH   = thirdH;

  // Determine wrapping strategy
  let lines: string[];
  if (spec.maxWordsPerLine !== undefined) {
    // Word-count-based wrap (enforced regardless of landscape/portrait)
    setLetterSpacing(ctx, headLS * headlinePx);
    ctx.font = headlineFont(headlinePx);
    lines = wrapPortraitText(text, spec.maxWordsPerLine);

    // Pixel-overflow safety: reduce font until every line fits within maxW
    let maxLineW = Math.max(...lines.map(l => ctx.measureText(l).width));
    const floorPx = 8;
    while (maxLineW > maxW && headlinePx > floorPx) {
      headlinePx = Math.max(floorPx, headlinePx - 0.5);
      setLetterSpacing(ctx, headLS * headlinePx);
      ctx.font = headlineFont(headlinePx);
      maxLineW = Math.max(...lines.map(l => ctx.measureText(l).width));
    }
  } else if (isPortrait) {
    // Portrait default: max 4 words/line, pixel-overflow safety included
    setLetterSpacing(ctx, headLS * headlinePx);
    ctx.font = headlineFont(headlinePx);
    lines = wrapPortraitText(text, 4);

    let maxLineW = Math.max(...lines.map(l => ctx.measureText(l).width));
    const floorPx = 8;
    while (maxLineW > maxW && headlinePx > floorPx) {
      headlinePx = Math.max(floorPx, headlinePx - 0.5);
      setLetterSpacing(ctx, headLS * headlinePx);
      ctx.font = headlineFont(headlinePx);
      maxLineW = Math.max(...lines.map(l => ctx.measureText(l).width));
    }
  } else {
    // Landscape/square: pixel-width wrap (reference behaviour, e.g. 300×250)
    setLetterSpacing(ctx, headLS * headlinePx);
    ctx.font = headlineFont(headlinePx);
    lines = wrapText(ctx, text, maxW);
  }

  const lineH  = headlinePx * headLH;
  const blockH = textBlockHeight(lines.length, lineH);

  ctx.fillStyle    = '#FFFFFF';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';

  const textStartY = midTop + (midH - blockH) / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], W / 2, textStartY + i * lineH);
  }
  setLetterSpacing(ctx, 0);
}

// ---------------------------------------------------------------------------
// Poster layout — logo discrete top | large editorial headline | CTA footnote
// ---------------------------------------------------------------------------
function renderPosterLayout(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  text: string, cta: string,
  logoImg: HTMLImageElement,
  spec: FormatSpec,
  isPortrait: boolean,
): void {
  const padX     = spec.padXSpec !== undefined ? spec.padXSpec : W * 0.08;
  const padY     = H * 0.08;
  const maxW     = W - padX * 2;
  const align    = spec.textAlign ?? (isPortrait ? 'center' : 'left');
  const innerGap = padY * 0.35; // breathing room between logo→headline and headline→CTA

  // ── Logo (pinned top, small and discrete) ─────────────────────────────────
  const rawLogoW  = spec.logoH * LOGO_ASPECT;
  const logoW     = Math.min(rawLogoW, maxW);
  const logoH     = logoW / LOGO_ASPECT;
  const logoX     = align === 'left' ? padX : (W - logoW) / 2;
  ctx.drawImage(logoImg, logoX, padY, logoW, logoH);

  // ── CTA (pinned bottom, footnote-sized) ───────────────────────────────────
  const ctaPx     = spec.ctaPx ?? spec.headlinePx * 0.15;
  const ruleH     = Math.max(0.5, ctaPx * 0.05);
  const ruleGap   = Math.max(1,   ctaPx * 0.15);
  const ctaBlockH = ctaPx + ruleGap + ruleH;
  const ctaY      = H - padY - ctaBlockH;

  if (spec.ctaPx !== null && cta.trim().length > 0) {
    if (align === 'left') {
      drawCTALeft(ctx, padX, cta, ctaPx, ctaY, ruleH, ruleGap);
    } else {
      drawCTACentered(ctx, W, cta, ctaPx, ctaY, ruleH, ruleGap);
    }
  }

  // ── Headline (fills the large middle zone) ────────────────────────────────
  const headlineZoneTop = padY + logoH + innerGap;
  const headlineZoneBot = ctaY - innerGap;
  const headlineZoneH   = headlineZoneBot - headlineZoneTop;

  if (headlineZoneH <= 0 || text.trim().length === 0) return;

  let headlinePx = spec.headlinePx;
  const { headLS, headLH } = spec;
  const wordsPerLine = spec.maxWordsPerLine ?? (isPortrait ? 3 : 4);
  const floorPx      = Math.max(14, H * 0.02);

  const lines = wrapPortraitText(text, wordsPerLine);
  if (lines.length === 0) return;

  // Overflow loop: reduce font until block fits in headline zone AND all lines fit maxW
  while (headlinePx > floorPx) {
    setLetterSpacing(ctx, headLS * headlinePx);
    ctx.font = headlineFont(headlinePx);
    const lineH    = headlinePx * headLH;
    const blockH   = textBlockHeight(lines.length, lineH);
    const maxLineW = Math.max(...lines.map(l => ctx.measureText(l).width));
    if (blockH <= headlineZoneH && maxLineW <= maxW) break;
    headlinePx = Math.max(floorPx, headlinePx - 0.5);
  }

  const lineH     = headlinePx * headLH;
  const blockH    = textBlockHeight(lines.length, lineH);
  const textStartY = headlineZoneTop + (headlineZoneH - blockH) / 2;

  ctx.fillStyle    = '#FFFFFF';
  ctx.textBaseline = 'top';

  if (align === 'left') {
    ctx.textAlign = 'left';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], padX, textStartY + i * lineH);
    }
  } else {
    ctx.textAlign = 'center';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W / 2, textStartY + i * lineH);
    }
  }

  setLetterSpacing(ctx, 0);
}

// ---------------------------------------------------------------------------
// Horizontal layout — logo left | headline center (no wrap) | CTA right
// ---------------------------------------------------------------------------
function renderHorizontalLayout(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  text: string, cta: string,
  logoImg: HTMLImageElement,
  spec: FormatSpec,
): void {
  const padX = Math.max(4, W * 0.025);
  const midY = H / 2;

  // ── Logo (left, vertically centered, natural aspect ratio) ────────────────
  const logoH = Math.min(spec.logoH, H * 0.80);
  const logoW = logoH * LOGO_ASPECT;
  ctx.drawImage(logoImg, padX, midY - logoH / 2, logoW, logoH);

  // ── CTA (right, char-by-char for precise alignment) ───────────────────────
  const ctaPx      = spec.ctaPx ?? spec.headlinePx * 0.4;
  const ctaDisplay = cta.toUpperCase();
  const letterSp   = ctaPx * 0.10;
  setLetterSpacing(ctx, 0);
  ctx.font = ctaFont(ctaPx);
  const chars      = ctaDisplay.split('');
  const charWidths = chars.map(c => ctx.measureText(c).width);
  const ctaTextW   = charWidths.reduce((s, w) => s + w, 0) + letterSp * Math.max(0, chars.length - 1);
  const ruleH      = Math.max(0.5, H * 0.012);
  const ruleGap    = Math.max(1,   ctaPx * 0.15);
  const ctaTextY   = midY - (ctaPx + ruleGap + ruleH) / 2;

  ctx.fillStyle    = '#FFFFFF';
  ctx.textBaseline = 'top';
  let cx = W - padX - ctaTextW;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, ctaTextY);
    cx += charWidths[i] + letterSp;
  }

  // Underline rule
  const ruleW = ctaTextW + ctaPx * 0.4;
  const ruleX = W - padX - ruleW;
  const ruleY = ctaTextY + ctaPx + ruleGap;
  ctx.beginPath();
  ctx.moveTo(ruleX, ruleY);
  ctx.lineTo(W - padX, ruleY);
  ctx.strokeStyle = 'rgba(255,255,255,0.60)';
  ctx.lineWidth   = ruleH;
  ctx.stroke();

  // ── Headline (center zone) ────────────────────────────────────────────────
  const textStart  = padX + logoW + padX;
  const textEnd    = ruleX - padX;
  const textAvailW = textEnd - textStart;

  if (textAvailW > 20) {
    let headlinePx  = spec.headlinePx;  // mutable for auto-shrink
    const { headLS } = spec;

    setLetterSpacing(ctx, headLS * headlinePx);
    ctx.font         = headlineFont(headlinePx);
    ctx.fillStyle    = '#FFFFFF';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    if (spec.autoShrinkHeadline) {
      // Reduce font size until full text fits — no truncation, floor at headlineFloorPx
      const floorPx = spec.headlineFloorPx ?? 8;
      while (ctx.measureText(text).width > textAvailW && headlinePx > floorPx) {
        headlinePx = Math.max(floorPx, headlinePx - 0.5);
        setLetterSpacing(ctx, headLS * headlinePx);
        ctx.font = headlineFont(headlinePx);
      }
      ctx.fillText(text, textStart + textAvailW / 2, midY);
    } else {
      // Default: truncate with ellipsis
      let displayText = text;
      while (ctx.measureText(displayText).width > textAvailW && displayText.length > 1) {
        const lastSpace = displayText.lastIndexOf(' ');
        displayText = lastSpace > 0
          ? displayText.substring(0, lastSpace) + '…'
          : displayText.slice(0, -2) + '…';
      }
      ctx.fillText(displayText, textStart + textAvailW / 2, midY);
    }
    setLetterSpacing(ctx, 0);
  }
}

// ---------------------------------------------------------------------------
// CTA helper (vertical layout) — centered uppercase text + thin underline
// ---------------------------------------------------------------------------
function drawCTACentered(
  ctx: CanvasRenderingContext2D,
  W: number,
  cta: string,
  ctaPx: number,
  ctaY: number,
  ruleH: number,
  ruleGap: number,
): void {
  const ctaDisplay = cta.toUpperCase();
  const letterSp   = ctaPx * 0.10;
  setLetterSpacing(ctx, 0);
  ctx.font = ctaFont(ctaPx);
  const chars      = ctaDisplay.split('');
  const charWidths = chars.map(c => ctx.measureText(c).width);
  const totalW     = charWidths.reduce((s, w) => s + w, 0) + letterSp * Math.max(0, chars.length - 1);

  ctx.fillStyle    = '#FFFFFF';
  ctx.textBaseline = 'top';
  let x = W / 2 - totalW / 2;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, ctaY);
    x += charWidths[i] + letterSp;
  }

  const ruleW = totalW + ctaPx * 0.3;
  const ruleX = W / 2 - ruleW / 2;
  const ruleY = ctaY + ctaPx + ruleGap;
  ctx.beginPath();
  ctx.moveTo(ruleX, ruleY);
  ctx.lineTo(ruleX + ruleW, ruleY);
  ctx.strokeStyle = 'rgba(255,255,255,0.60)';
  ctx.lineWidth   = ruleH;
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// CTA helper (poster left-aligned) — left-anchored uppercase text + underline
// ---------------------------------------------------------------------------
function drawCTALeft(
  ctx: CanvasRenderingContext2D,
  padX: number,
  cta: string,
  ctaPx: number,
  ctaY: number,
  ruleH: number,
  ruleGap: number,
): void {
  const ctaDisplay = cta.toUpperCase();
  const letterSp   = ctaPx * 0.10;
  setLetterSpacing(ctx, 0);
  ctx.font = ctaFont(ctaPx);
  const chars      = ctaDisplay.split('');
  const charWidths = chars.map(c => ctx.measureText(c).width);
  const totalW     = charWidths.reduce((s, w) => s + w, 0) + letterSp * Math.max(0, chars.length - 1);

  ctx.fillStyle    = '#FFFFFF';
  ctx.textBaseline = 'top';
  let x = padX;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, ctaY);
    x += charWidths[i] + letterSp;
  }

  const ruleW = totalW + ctaPx * 0.3;
  const ruleY = ctaY + ctaPx + ruleGap;
  ctx.beginPath();
  ctx.moveTo(padX, ruleY);
  ctx.lineTo(padX + ruleW, ruleY);
  ctx.strokeStyle = 'rgba(255,255,255,0.60)';
  ctx.lineWidth   = ruleH;
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: 'image/jpeg' | 'image/png',
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error(`toBlob returned null for ${type}`)),
      type,
      quality,
    );
  });
}

export async function exportWithSizeLimit(
  canvas: HTMLCanvasElement,
  format: 'jpg' | 'png',
  maxBytes: number,
): Promise<Blob> {
  if (format === 'png') {
    const blob = await canvasToBlob(canvas, 'image/png');
    if (blob.size <= maxBytes) return blob;
    return compressJpeg(canvas, maxBytes);
  }
  return compressJpeg(canvas, maxBytes);
}

async function compressJpeg(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  let quality = 0.92;
  let blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  while (blob.size > maxBytes && quality > 0.10) {
    quality = Math.max(0.10, quality - 0.08);
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  }
  return blob;
}
