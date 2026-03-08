/**
 * Core canvas rendering engine for Fin ad generator.
 * All rendering is client-side; this file must only be imported from client components.
 *
 * Background  : cover-fit image + rgba(10,14,26,0.50) dark overlay
 * Typography  : hardcoded per-format type specs — no dynamic scaling
 * Layout      : vertical thirds | horizontal (banner) | no-cta (768×1024)
 * CTA         : all-caps tracked text + thin underline rule — no button
 */

import { wrapText, textBlockHeight } from './textLayout';

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
  catch { /* noop in environments that don't support it */ }
}

// ---------------------------------------------------------------------------
// Per-format type specs — all values hardcoded, never calculated
// ---------------------------------------------------------------------------
interface FormatSpec {
  headlinePx: number;
  ctaPx:      number | null; // null → no CTA rendered (768×1024)
  logoH:      number;        // rendered logo height px; width = logoH × LOGO_ASPECT
  layout:     'vertical' | 'horizontal' | 'no-cta';
  headLS:     number;        // headline letter-spacing as fraction of headlinePx
  headLH:     number;        // headline line-height as fraction of headlinePx
}

const FORMAT_SPECS: Record<string, FormatSpec> = {
  '160x600':   { headlinePx: 22,  ctaPx: 13.65, logoH: 18,  layout: 'vertical',   headLS: -0.03, headLH: 0.95 },
  '300x250':   { headlinePx: 18,  ctaPx: 9,     logoH: 22,  layout: 'vertical',   headLS: -0.06, headLH: 1.00 },
  '728x90':    { headlinePx: 16,  ctaPx: 10,    logoH: 20,  layout: 'horizontal', headLS: -0.03, headLH: 0.95 },
  '300x600':   { headlinePx: 22,  ctaPx: 10,    logoH: 26,  layout: 'vertical',   headLS: -0.06, headLH: 1.00 },
  '320x50':    { headlinePx: 13,  ctaPx: 9,     logoH: 14,  layout: 'horizontal', headLS: -0.03, headLH: 0.95 },
  '300x50':    { headlinePx: 13,  ctaPx: 9,     logoH: 14,  layout: 'horizontal', headLS: -0.03, headLH: 0.95 },
  '768x1024':  { headlinePx: 28,  ctaPx: null,  logoH: 20,  layout: 'no-cta',     headLS: -0.06, headLH: 1.00 },
  '1024x768':  { headlinePx: 32,  ctaPx: 13,    logoH: 36,  layout: 'vertical',   headLS: -0.06, headLH: 1.00 },
  '320x480':   { headlinePx: 20,  ctaPx: 10,    logoH: 24,  layout: 'vertical',   headLS: -0.06, headLH: 0.95 },
  '970x250':   { headlinePx: 22,  ctaPx: 11,    logoH: 26,  layout: 'horizontal', headLS: -0.03, headLH: 0.95 },
  '480x320':   { headlinePx: 20,  ctaPx: 10,    logoH: 24,  layout: 'vertical',   headLS: -0.06, headLH: 1.00 },
  '1080x1080': { headlinePx: 42,  ctaPx: 15,    logoH: 48,  layout: 'vertical',   headLS: -0.06, headLH: 1.00 },
  '1200x1200': { headlinePx: 46,  ctaPx: 16,    logoH: 52,  layout: 'vertical',   headLS: -0.06, headLH: 1.00 },
  '1200x628':  { headlinePx: 32,  ctaPx: 13,    logoH: 36,  layout: 'vertical',   headLS: -0.06, headLH: 1.00 },
  '1080x1920': { headlinePx: 48,  ctaPx: 16,    logoH: 54,  layout: 'vertical',   headLS: -0.06, headLH: 1.00 },
  '1920x1080': { headlinePx: 38,  ctaPx: 14,    logoH: 44,  layout: 'vertical',   headLS: -0.03, headLH: 0.95 },
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
 * The canvas width/height are set inside this function.
 */
export async function renderAdToCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  text: string,
  cta: string,
  backgroundSrc: string,
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

  // 2. Wait for fonts to be ready in the browser
  if (typeof document !== 'undefined') await document.fonts.ready;

  // 3. Load logo
  const logoImg = await loadLogoImage();

  // 4. Resolve spec and route to layout
  const spec = getSpec(W, H);
  if (spec.layout === 'horizontal') {
    renderHorizontalLayout(ctx, W, H, text, cta, logoImg, spec);
  } else if (spec.layout === 'no-cta') {
    renderNoCTALayout(ctx, W, H, text, logoImg, spec);
  } else {
    renderVerticalLayout(ctx, W, H, text, cta, logoImg, spec);
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
): void {
  const padY     = H * 0.08;
  const padX     = W * 0.08;
  const contentH = H - padY * 2;
  const thirdH   = contentH / 3;

  // ── Logo (top third, centered, natural aspect ratio) ──────────────────────
  const rawLogoW   = spec.logoH * LOGO_ASPECT;
  const logoW      = Math.min(rawLogoW, W - padX * 2);
  const logoH      = logoW / LOGO_ASPECT;
  const logoX      = (W - logoW) / 2;
  const logoY      = padY + (thirdH - logoH) / 2;
  ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);

  // ── CTA (bottom third, centered, anchored near bottom edge) ───────────────
  if (spec.ctaPx !== null) {
    const ruleH  = Math.max(0.5, spec.ctaPx * 0.05);
    const ruleGap = Math.max(1, spec.ctaPx * 0.15);
    const ctaY   = H - padY - spec.ctaPx - ruleGap - ruleH;
    drawCTACentered(ctx, W, cta, spec.ctaPx, ctaY, ruleH, ruleGap);
  }

  // ── Headline (middle third, centered) ─────────────────────────────────────
  const { headlinePx, headLS, headLH } = spec;
  const lineH   = headlinePx * headLH;
  const midTop  = padY + thirdH;
  const midH    = thirdH;

  setLetterSpacing(ctx, headLS * headlinePx);
  ctx.font = headlineFont(headlinePx);
  const lines  = wrapText(ctx, text, W - padX * 2);
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

  // ── CTA (right, vertically centered, char-by-char for precise alignment) ──
  const ctaPx      = spec.ctaPx ?? spec.headlinePx * 0.4;
  const ctaDisplay = cta.toUpperCase();
  const letterSp   = ctaPx * 0.10;
  setLetterSpacing(ctx, 0);
  ctx.font = ctaFont(ctaPx);
  const chars      = ctaDisplay.split('');
  const charWidths = chars.map(c => ctx.measureText(c).width);
  const ctaTextW   = charWidths.reduce((s, w) => s + w, 0) + letterSp * Math.max(0, chars.length - 1);
  const ruleH      = Math.max(0.5, H * 0.012);
  const ruleGap    = Math.max(1, ctaPx * 0.15);
  const ctaTotalH  = ctaPx + ruleGap + ruleH;
  const ctaTextY   = midY - ctaTotalH / 2;

  ctx.fillStyle    = '#FFFFFF';
  ctx.textBaseline = 'top';
  let cx = W - padX - ctaTextW;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, ctaTextY);
    cx += charWidths[i] + letterSp;
  }

  // Underline rule beneath CTA
  const ruleW = ctaTextW + ctaPx * 0.4;
  const ruleX = W - padX - ruleW;
  const ruleY = ctaTextY + ctaPx + ruleGap;
  ctx.beginPath();
  ctx.moveTo(ruleX, ruleY);
  ctx.lineTo(W - padX, ruleY);
  ctx.strokeStyle = 'rgba(255,255,255,0.60)';
  ctx.lineWidth   = ruleH;
  ctx.stroke();

  // ── Headline (center zone, single line, truncate with ellipsis) ───────────
  const textStart  = padX + logoW + padX;
  const textEnd    = ruleX - padX;
  const textAvailW = textEnd - textStart;

  if (textAvailW > 20) {
    const { headlinePx, headLS } = spec;
    setLetterSpacing(ctx, headLS * headlinePx);
    ctx.font         = headlineFont(headlinePx);
    ctx.fillStyle    = '#FFFFFF';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    let displayText = text;
    while (ctx.measureText(displayText).width > textAvailW && displayText.length > 1) {
      const lastSpace = displayText.lastIndexOf(' ');
      displayText = lastSpace > 0
        ? displayText.substring(0, lastSpace) + '…'
        : displayText.slice(0, -2) + '…';
    }
    ctx.fillText(displayText, textStart + textAvailW / 2, midY);
    setLetterSpacing(ctx, 0);
  }
}

// ---------------------------------------------------------------------------
// No-CTA layout (768×1024) — logo top third | headline centered below
// ---------------------------------------------------------------------------
function renderNoCTALayout(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  text: string,
  logoImg: HTMLImageElement,
  spec: FormatSpec,
): void {
  const padY   = H * 0.08;
  const padX   = W * 0.08;
  const thirdH = (H - padY * 2) / 3;

  // ── Logo (top third, centered) ────────────────────────────────────────────
  const rawLogoW = spec.logoH * LOGO_ASPECT;
  const logoW    = Math.min(rawLogoW, W - padX * 2);
  const logoH    = logoW / LOGO_ASPECT;
  const logoX    = (W - logoW) / 2;
  const logoY    = padY + (thirdH - logoH) / 2;
  ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);

  // ── Headline (centered in lower two-thirds) ───────────────────────────────
  const { headlinePx, headLS, headLH } = spec;
  const lineH   = headlinePx * headLH;
  const zoneTop = padY + thirdH;
  const zoneH   = thirdH * 2;

  setLetterSpacing(ctx, headLS * headlinePx);
  ctx.font = headlineFont(headlinePx);
  const lines  = wrapText(ctx, text, W - padX * 2);
  const blockH = textBlockHeight(lines.length, lineH);

  ctx.fillStyle    = '#FFFFFF';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';

  const textStartY = zoneTop + (zoneH - blockH) / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], W / 2, textStartY + i * lineH);
  }
  setLetterSpacing(ctx, 0);
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

  // Thin underline rule
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

/**
 * Export canvas to a Blob of the given format, compressing JPEG quality
 * iteratively until the file fits within maxBytes.
 */
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
