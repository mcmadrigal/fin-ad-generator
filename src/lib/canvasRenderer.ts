/**
 * Core canvas rendering engine for Fin ad generator.
 * All rendering is client-side; this file must only be imported from client components.
 */

import type { GradientParams } from '@/types';
import { drawGradientBackground, enforceContrast } from './gradientEngine';
import { calcFontSize, wrapText, textBlockHeight } from './textLayout';

// ---------------------------------------------------------------------------
// Real Fin logo — fetched from /public/logos/lockup_white.svg at runtime.
// The SVG has viewBox="0 0 556 196" (aspect ≈ 2.837).
// ---------------------------------------------------------------------------
const LOGO_ASPECT = 556 / 196; // real lockup aspect ratio

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
// Font helpers — use actual brand fonts loaded via @font-face in globals.css
// Brand typography mapping:
//   Ad copy (headline/text):  Ivory LL Light 300 — editorial display serif
//   CTA:                      Aeonik Fono 400 — ALL CAPS accent mono-grotesk
// ---------------------------------------------------------------------------
const HEADLINE_FONT_STACK = "'Ivory LL', Georgia, 'Times New Roman', serif";
const CTA_FONT_STACK      = "'Aeonik Fono', 'Medium LL', -apple-system, sans-serif";

function headlineFont(size: number): string {
  return `300 ${size}px ${HEADLINE_FONT_STACK}`;
}
function ctaFont(size: number): string {
  return `400 ${size}px ${CTA_FONT_STACK}`;
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
  gradientParams: GradientParams,
): Promise<void> {
  canvas.width  = Math.round(width);
  canvas.height = Math.round(height);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const W = canvas.width;
  const H = canvas.height;

  // 1. Background
  drawGradientBackground(ctx, W, H, gradientParams);
  enforceContrast(ctx, W, H, 4.5);

  // 2. Wait for fonts to be ready in the browser
  if (typeof document !== 'undefined') {
    await document.fonts.ready;
  }

  // 3. Load logo
  const logoImg = await loadLogoImage();

  // 4. Choose layout based on proportions
  if (H <= 70) {
    await renderUltraShortBanner(ctx, W, H, text, cta, logoImg);
  } else if (H <= 130 && W > H * 2.5) {
    await renderShortBanner(ctx, W, H, text, cta, logoImg);
  } else {
    await renderStandardLayout(ctx, W, H, text, cta, logoImg);
  }
}

// ---------------------------------------------------------------------------
// Ultra-short banner (h ≤ 70px): e.g. 320×50, 300×50
// Single horizontal strip: logo-icon | text | CTA-pill
// ---------------------------------------------------------------------------
async function renderUltraShortBanner(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  text: string, cta: string,
  logoImg: HTMLImageElement,
): Promise<void> {
  const pad = Math.max(H * 0.1, 3);
  const innerH = H - pad * 2;

  // Logo icon portion only (leftmost ~40px of SVG contains the asterisk mark)
  const iconW = innerH * 1.0; // roughly square
  ctx.drawImage(logoImg, 0, 0, 70, 44, pad, pad, iconW, innerH); // src: first 70px of 180px SVG

  // CTA pill on right
  const ctaSize = calcFontSize(H, 0.30, 7, 12);
  ctx.font = ctaFont(ctaSize);
  const ctaDisplay = cta.toUpperCase();
  const ctaMetrics = ctx.measureText(ctaDisplay);
  const pillPadX = ctaSize * 0.9;
  const pillW    = ctaMetrics.width + pillPadX * 2;
  const pillX    = W - pad - pillW;
  const pillY    = pad;
  const pillH    = innerH;

  ctx.fillStyle = '#FF5600';
  roundRect(ctx, pillX, pillY, pillW, pillH, 2);
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ctaDisplay, pillX + pillW / 2, H / 2);

  // Text in the middle
  const textSize = calcFontSize(H, 0.25, 7, 12);
  ctx.font = headlineFont(textSize);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textAreaStart = pad + iconW + pad;
  const textAreaEnd   = pillX - pad;
  const textAreaW     = textAreaEnd - textAreaStart;
  if (textAreaW > 20) {
    let displayText = text;
    while (ctx.measureText(displayText).width > textAreaW && displayText.includes(' ')) {
      displayText = displayText.substring(0, displayText.lastIndexOf(' ')) + '…';
    }
    ctx.fillText(displayText, textAreaStart + textAreaW / 2, H / 2);
  }
}

// ---------------------------------------------------------------------------
// Short/wide banner (70 < h ≤ 130, w > h*2.5): e.g. 728×90, 970×250
// Horizontal: logo-left | headline-centre | CTA-right
// ---------------------------------------------------------------------------
async function renderShortBanner(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  text: string, cta: string,
  logoImg: HTMLImageElement,
): Promise<void> {
  const pad = Math.max(H * 0.12, 6);

  // Logo on left (full lockup)
  const logoH = H - pad * 2;
  const logoW = Math.min(logoH * LOGO_ASPECT, W * 0.22);
  const logoX = pad;
  const logoY = pad;
  ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);

  // CTA pill on right
  const ctaSize = calcFontSize(H, 0.22, 9, 16);
  ctx.font = ctaFont(ctaSize);
  const ctaDisplay = cta.toUpperCase();
  const ctaMetrics = ctx.measureText(ctaDisplay);
  const pillPadX = ctaSize * 1.1;
  const pillPadY = ctaSize * 0.55;
  const pillW    = ctaMetrics.width + pillPadX * 2;
  const pillH    = ctaSize + pillPadY * 2;
  const pillX    = W - pad - pillW;
  const pillY    = (H - pillH) / 2;

  ctx.fillStyle = '#FF5600';
  roundRect(ctx, pillX, pillY, pillW, pillH, 3);
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ctaDisplay, pillX + pillW / 2, pillY + pillH / 2);

  // Headline text centered in remaining space
  const textSize = calcFontSize(H, 0.26, 10, 20);
  ctx.font = headlineFont(textSize);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const midX    = logoX + logoW + pad + (pillX - logoX - logoW - pad * 2) / 2;
  const midY    = H / 2;
  const availW  = pillX - logoX - logoW - pad * 4;

  let displayText = text;
  while (ctx.measureText(displayText).width > availW && displayText.includes(' ')) {
    displayText = displayText.substring(0, displayText.lastIndexOf(' ')) + '…';
  }
  if (availW > 20) ctx.fillText(displayText, midX, midY);
}

// ---------------------------------------------------------------------------
// Standard layout: logo top | headline middle | CTA bottom
// Handles all remaining sizes including very narrow (160×600) and square/portrait.
// ---------------------------------------------------------------------------
async function renderStandardLayout(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  text: string, cta: string,
  logoImg: HTMLImageElement,
): Promise<void> {
  const minDim  = Math.min(W, H);
  const safePad = Math.max(minDim * 0.06, 10);

  // ── Logo ──────────────────────────────────────────────────────────────────
  const logoMaxW = Math.min(W * 0.40, 160);
  const logoW    = logoMaxW;
  const logoH    = logoW / LOGO_ASPECT;
  const clampedLogoH = Math.min(logoH, H * 0.18);
  const clampedLogoW = clampedLogoH * LOGO_ASPECT;
  const logoX    = (W - clampedLogoW) / 2;
  const logoY    = safePad;
  ctx.drawImage(logoImg, logoX, logoY, clampedLogoW, clampedLogoH);

  // ── CTA ───────────────────────────────────────────────────────────────────
  const ctaSize    = calcFontSize(H, 0.035, 10, 18);
  const ctaDisplay = cta.toUpperCase();
  ctx.font      = ctaFont(ctaSize);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const ctaMetrics  = ctx.measureText(ctaDisplay);
  const ctaLineH    = ctaSize * 1.5; // space for text + underline
  const ctaBlockH   = ctaLineH + 4;  // underline + gap
  const ctaY        = H - safePad - ctaBlockH;

  // ── Headline ──────────────────────────────────────────────────────────────
  const logoZoneBottom = logoY + clampedLogoH + safePad;
  const ctaZoneTop     = ctaY - safePad;
  const textZoneH      = ctaZoneTop - logoZoneBottom;

  const textSize = calcFontSize(H, 0.08, 14, 72);
  const lineH    = textSize * 1.22;

  ctx.font = headlineFont(textSize);
  const maxTextW = W - safePad * 2.5;
  const lines    = wrapText(ctx, text, maxTextW);
  const blockH   = textBlockHeight(lines.length, lineH);

  // Centre text block within text zone
  let textStartY = logoZoneBottom + (textZoneH - blockH) / 2;
  // Guard: never overlap logo or CTA zones
  textStartY = Math.max(textStartY, logoZoneBottom);
  if (textStartY + blockH > ctaZoneTop - safePad * 0.5) {
    // Compress: just put it right after logo zone with safe padding
    textStartY = logoZoneBottom;
  }

  ctx.fillStyle    = '#FFFFFF';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], W / 2, textStartY + i * lineH);
  }

  // ── CTA text + underline rule ──────────────────────────────────────────────
  ctx.font         = ctaFont(ctaSize);
  ctx.fillStyle    = '#FFFFFF';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';

  // Simulate letter-spacing by distributing characters
  drawSpacedText(ctx, ctaDisplay, W / 2, ctaY, ctaSize * 0.12);

  // Thin rule beneath CTA (matches editorial visual language in reference images)
  const ruleW  = ctaMetrics.width + ctaSize * 0.24 * (ctaDisplay.length - 1) + ctaSize * 0.8;
  const ruleY  = ctaY + ctaSize + 5;
  const ruleX  = W / 2 - ruleW / 2;

  ctx.beginPath();
  ctx.moveTo(ruleX, ruleY);
  ctx.lineTo(ruleX + ruleW, ruleY);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth   = Math.max(0.5, H * 0.0008);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Draw text with manual letter spacing (canvas letterSpacing not universally reliable) */
function drawSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  spacing: number,
): void {
  const chars  = text.split('');
  const widths = chars.map(c => ctx.measureText(c).width);
  const totalW = widths.reduce((s, w) => s + w, 0) + spacing * (chars.length - 1);
  let x = centerX - totalW / 2;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x + widths[i] / 2, y);
    x += widths[i] + spacing;
  }
}

/** Draw a rounded rectangle path (does not fill/stroke) */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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
    // PNG is lossless — if it exceeds the limit, fall back to high-quality JPEG
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
