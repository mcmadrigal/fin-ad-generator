/**
 * Core canvas rendering engine for Fin ad generator.
 * All rendering is client-side; this file must only be imported from client components.
 *
 * Background : cover-fit image + rgba(10,14,26,0.50) dark overlay
 * Typography : format-aware scaling  (display / banner / tall-narrow)
 * Layout     : vertical thirds (standard) | horizontal (banner)
 * CTA        : all-caps tracked text + thin underline rule — no button
 */

import { wrapText, textBlockHeight } from './textLayout';

// ---------------------------------------------------------------------------
// Fin logo (white lockup) — viewBox="0 0 556 196", aspect ≈ 2.837
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
const CTA_FONT_STACK      = "'Aeonik Fono', 'Medium LL', -apple-system, sans-serif";

function headlineFont(size: number): string { return `300 ${size}px ${HEADLINE_FONT_STACK}`; }
function ctaFont(size: number):     string  { return `400 ${size}px ${CTA_FONT_STACK}`; }

// ---------------------------------------------------------------------------
// Format classification
// ---------------------------------------------------------------------------
type AdFormat = 'banner' | 'tall-narrow' | 'display';

function classifyFormat(W: number, H: number): AdFormat {
  if (H <= 250 && W >= H * 2.5) return 'banner';
  if (W <= 200 && H >= W * 2)   return 'tall-narrow';
  return 'display';
}

// ---------------------------------------------------------------------------
// Font size helpers
// ---------------------------------------------------------------------------

/** Format-aware headline size, clamped 11–64px */
function calcHeadlinePx(W: number, H: number, fmt: AdFormat): number {
  let size: number;
  if      (fmt === 'banner')       size = H * 0.55;
  else if (fmt === 'tall-narrow')  size = Math.min(W * 0.18, 22);
  else                             size = Math.min(W, H) * 0.09;
  return Math.max(11, Math.min(64, size));
}

/** Logo height: min(w,h) × 0.12, never > 48px; banner also caps at H × 0.50 */
function calcLogoPx(W: number, H: number, fmt: AdFormat): number {
  let h = Math.min(W, H) * 0.12;
  h = Math.min(h, 48);
  if (fmt === 'banner') h = Math.min(h, H * 0.50);
  return Math.max(6, h);
}

/** CTA = headline × 0.4, clamped 11–64px */
function calcCtaPx(headlinePx: number): number {
  return Math.max(11, Math.min(64, headlinePx * 0.4));
}

// ---------------------------------------------------------------------------
// Background: cover-fit + deep navy overlay
// ---------------------------------------------------------------------------
function drawCoverBackground(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  img: HTMLImageElement,
): void {
  const scaleX = W / img.naturalWidth;
  const scaleY = H / img.naturalHeight;
  const scale  = Math.max(scaleX, scaleY); // cover — never letterbox
  const dw = img.naturalWidth  * scale;
  const dh = img.naturalHeight * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);

  // Deep navy overlay at 50% opacity
  ctx.fillStyle = 'rgba(10,14,26,0.50)';
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Renders a Fin ad to the given canvas at the requested pixel dimensions.
 * The canvas width/height will be set inside this function.
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

  // 4. Route to the correct layout
  const fmt = classifyFormat(W, H);
  if (fmt === 'banner') {
    renderBannerLayout(ctx, W, H, text, cta, logoImg);
  } else {
    renderStandardLayout(ctx, W, H, text, cta, logoImg, fmt);
  }
}

// ---------------------------------------------------------------------------
// Standard layout: vertical thirds
// Logo → top third | Headline → middle third | CTA → bottom third
// ---------------------------------------------------------------------------
function renderStandardLayout(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  text: string, cta: string,
  logoImg: HTMLImageElement,
  fmt: AdFormat,
): void {
  const pad      = H * 0.08;
  const contentH = H - pad * 2;
  const thirdH   = contentH / 3;

  // ── Logo (top third, centered) ────────────────────────────────────────────
  const rawLogoH   = calcLogoPx(W, H, fmt);
  const rawLogoW   = rawLogoH * LOGO_ASPECT;
  const maxLogoW   = W - pad * 2;
  const finalLogoW = Math.min(rawLogoW, maxLogoW);
  const finalLogoH = finalLogoW / LOGO_ASPECT;
  const logoX      = (W - finalLogoW) / 2;
  const logoY      = (pad + thirdH / 2) - finalLogoH / 2;
  ctx.drawImage(logoImg, logoX, logoY, finalLogoW, finalLogoH);

  // ── Font sizes ─────────────────────────────────────────────────────────────
  const headlinePx = calcHeadlinePx(W, H, fmt);
  const ctaPx      = calcCtaPx(headlinePx);

  // ── CTA (anchored at bottom of bottom third) ───────────────────────────────
  const ruleH   = Math.max(0.5, H * 0.0012);
  const ruleGap = Math.max(2, ctaPx * 0.2);
  const ctaY    = H - pad - ctaPx - ruleGap - ruleH;
  drawCtaCentered(ctx, W, cta, ctaPx, ctaY, ruleH, ruleGap);

  // ── Headline (middle third, centered, auto-reduce font if overflow) ────────
  const midTop  = pad + thirdH;
  const midH    = thirdH;
  const maxW    = W - pad * 2.5;

  let fontSize = headlinePx;
  ctx.font = headlineFont(fontSize);
  let lines = wrapText(ctx, text, maxW);

  // Reduce font size until block fits within the middle third
  while (fontSize > 11 && textBlockHeight(lines.length, fontSize * 1.22) > midH * 0.92) {
    fontSize = Math.max(11, fontSize - 1);
    ctx.font = headlineFont(fontSize);
    lines = wrapText(ctx, text, maxW);
  }

  const blockH     = textBlockHeight(lines.length, fontSize * 1.22);
  const textStartY = midTop + midH / 2 - blockH / 2;

  ctx.font         = headlineFont(fontSize);
  ctx.fillStyle    = '#FFFFFF';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], W / 2, textStartY + i * (fontSize * 1.22));
  }
}

// ---------------------------------------------------------------------------
// Banner layout: logo left | text center (no wrap) | CTA right
// ---------------------------------------------------------------------------
function renderBannerLayout(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  text: string, cta: string,
  logoImg: HTMLImageElement,
): void {
  const pad    = H * 0.08;
  const midY   = H / 2;
  const innerH = H - pad * 2;

  const headlinePx = calcHeadlinePx(W, H, 'banner');
  const ctaPx      = calcCtaPx(headlinePx);

  // ── Logo (left, vertically centered) ─────────────────────────────────────
  const rawLogoH = Math.min(innerH * 0.70, calcLogoPx(W, H, 'banner'));
  const rawLogoW = rawLogoH * LOGO_ASPECT;
  const logoW    = Math.min(rawLogoW, W * 0.22);
  const logoH    = logoW / LOGO_ASPECT;
  const logoX    = pad;
  const logoY    = midY - logoH / 2;
  ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);

  // ── CTA (right, right-aligned, vertically centered) ───────────────────────
  ctx.font = ctaFont(ctaPx);
  const ctaDisplay = cta.toUpperCase();
  const letterSp   = ctaPx * 0.18;
  const chars      = ctaDisplay.split('');
  const charWidths = chars.map(c => ctx.measureText(c).width);
  const ctaTextW   = charWidths.reduce((s, w) => s + w, 0) + letterSp * Math.max(0, chars.length - 1);
  const ruleH      = Math.max(0.5, H * 0.012);
  const ruleGap    = Math.max(1, ctaPx * 0.2);
  const ctaTotalH  = ctaPx + ruleGap + ruleH;
  const ctaTextY   = midY - ctaTotalH / 2;

  ctx.fillStyle    = '#FFFFFF';
  ctx.textBaseline = 'top';
  let cx = W - pad - ctaTextW;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, ctaTextY);
    cx += charWidths[i] + letterSp;
  }

  // Underline rule beneath CTA
  const ruleW = ctaTextW + ctaPx * 0.4;
  const ruleX = W - pad - ruleW;
  const ruleY = ctaTextY + ctaPx + ruleGap;
  ctx.beginPath();
  ctx.moveTo(ruleX, ruleY);
  ctx.lineTo(ruleX + ruleW, ruleY);
  ctx.strokeStyle = 'rgba(255,255,255,0.60)';
  ctx.lineWidth   = ruleH;
  ctx.stroke();

  // ── Headline (center zone, single line, truncate with ellipsis) ───────────
  const textStart  = logoX + logoW + pad;
  const textEnd    = ruleX - pad;
  const textAvailW = textEnd - textStart;

  if (textAvailW > 20) {
    ctx.font         = headlineFont(headlinePx);
    ctx.fillStyle    = '#FFFFFF';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    let displayText = text;
    while (ctx.measureText(displayText).width > textAvailW && displayText.length > 1) {
      const lastSpace = displayText.lastIndexOf(' ');
      if (lastSpace > 0) {
        displayText = displayText.substring(0, lastSpace) + '…';
      } else {
        displayText = displayText.slice(0, -2) + '…';
      }
    }
    ctx.fillText(displayText, textStart + textAvailW / 2, midY);
  }
}

// ---------------------------------------------------------------------------
// CTA helper (standard layout): centered, tracked uppercase + thin underline
// ---------------------------------------------------------------------------
function drawCtaCentered(
  ctx: CanvasRenderingContext2D,
  W: number,
  cta: string,
  ctaPx: number,
  ctaY: number,
  ruleH: number,
  ruleGap: number,
): void {
  ctx.font = ctaFont(ctaPx);
  const ctaDisplay = cta.toUpperCase();
  const letterSp   = ctaPx * 0.18;
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

  // Thin underline rule beneath CTA
  const ruleW = totalW + ctaPx * 0.4;
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
