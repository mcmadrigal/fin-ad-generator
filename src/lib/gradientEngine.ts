import type { GradientParams } from '@/types';

// ---------------------------------------------------------------------------
// Seeded PRNG (LCG — fast, deterministic, good enough for visual variation)
// ---------------------------------------------------------------------------
function seededRandom(seed: number) {
  let s = seed >>> 0;
  return (): number => {
    s = Math.imul(1664525, s) + 1013904223 >>> 0;
    return s / 0xffffffff;
  };
}

// ---------------------------------------------------------------------------
// Aesthetic glow hue families (drawn from reference image analysis)
// ---------------------------------------------------------------------------
const GLOW_PALETTES: Array<[number, number]> = [
  [200, 235], // cool cyan-blue (most common in reference images)
  [250, 280], // indigo-violet
  [28,  50],  // warm amber/gold (like the sunrise glow in Rectangle 8665)
  [320, 340], // dusty rose-magenta
  [170, 200], // teal
];

export function generateGradientParams(seed?: number): GradientParams {
  const s = seed ?? Date.now();
  const rand = seededRandom(s);

  const paletteIdx = Math.floor(rand() * GLOW_PALETTES.length);
  const [hMin, hMax] = GLOW_PALETTES[paletteIdx];
  const glowHue = hMin + rand() * (hMax - hMin);

  return {
    seed:         s,
    glowX:        0.25 + rand() * 0.5,   // 0.25–0.75 — stays away from extreme edges
    glowY:        0.25 + rand() * 0.55,  // 0.25–0.80 — slightly biased toward lower half
    glowRadius:   0.30 + rand() * 0.35,  // 0.30–0.65
    glowHue,
    glowSat:      55 + rand() * 35,      // 55–90% — vivid but not garish
    glowLit:      25 + rand() * 20,      // 25–45% at glow centre
    glowIntensity:0.40 + rand() * 0.40,  // 0.40–0.80
    baseHue:      220 + rand() * 15,     // 220–235 — deep navy range
  };
}

// ---------------------------------------------------------------------------
// Core gradient renderer
// ---------------------------------------------------------------------------
export function drawGradientBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: GradientParams,
): void {
  const { glowX, glowY, glowRadius, glowHue, glowSat, glowLit, glowIntensity, baseHue } = params;

  // --- Base fill: deep navy close to brand Deep Blue (#080F1E ~ hsl(220,64%,8%)) ---
  ctx.fillStyle = `hsl(${baseHue}, 58%, 6%)`;
  ctx.fillRect(0, 0, width, height);

  // --- Primary radial glow ---
  const gx = glowX * width;
  const gy = glowY * height;
  const gr = glowRadius * Math.max(width, height);

  const g1 = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
  g1.addColorStop(0.00, `hsla(${glowHue}, ${glowSat}%, ${glowLit}%, ${glowIntensity})`);
  g1.addColorStop(0.20, `hsla(${glowHue}, ${glowSat}%, ${glowLit * 0.65}%, ${glowIntensity * 0.55})`);
  g1.addColorStop(0.55, `hsla(${glowHue}, ${glowSat * 0.7}%, ${glowLit * 0.3}%, ${glowIntensity * 0.18})`);
  g1.addColorStop(1.00, `hsla(${glowHue}, 30%, 5%, 0)`);
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, width, height);

  // --- Secondary subtle glow (offset, complementary hue shift) ---
  const g2x = gx + (0.5 - glowX) * width * 0.25;
  const g2y = gy - height * 0.12;
  const g2r = gr * 0.5;
  const h2  = (glowHue + 150) % 360;

  const g2 = ctx.createRadialGradient(g2x, g2y, 0, g2x, g2y, g2r);
  g2.addColorStop(0, `hsla(${h2}, 45%, 18%, 0.07)`);
  g2.addColorStop(1, `hsla(${h2}, 30%, 5%, 0)`);
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, width, height);

  // --- Vignette: darkens edges strongly, creating atmospheric depth ---
  const vInner = Math.min(width, height) * 0.25;
  const vOuter = Math.max(width, height) * 0.85;
  const vig = ctx.createRadialGradient(
    width / 2, height / 2, vInner,
    width / 2, height / 2, vOuter,
  );
  vig.addColorStop(0.0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.4, 'rgba(0,0,0,0.04)');
  vig.addColorStop(0.75, 'rgba(0,0,0,0.35)');
  vig.addColorStop(1.0,  'rgba(0,0,0,0.72)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);
}

// ---------------------------------------------------------------------------
// WCAG AA contrast enforcement
// Samples the canvas and applies a darkening overlay if contrast < minRatio
// White text (luminance ≈ 1.0) needs: (bg + 0.05) / (1 + 0.05) >= 1/minRatio
// → bg luminance must be ≤ (1.05 / minRatio) - 0.05
// For 4.5:1 → bg luminance ≤ 0.183
// ---------------------------------------------------------------------------
export function enforceContrast(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  minRatio = 4.5,
): void {
  // Sample a representative centre region for average luminance
  const sx = Math.round(width  * 0.2);
  const sy = Math.round(height * 0.2);
  const sw = Math.round(width  * 0.6);
  const sh = Math.round(height * 0.6);

  const data = ctx.getImageData(sx, sy, sw, sh).data;
  let lumSum = 0;
  const px   = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    lumSum += sRGBLuminance(data[i], data[i + 1], data[i + 2]);
  }
  const avgLum  = lumSum / px;
  const ratio   = (1.05) / (avgLum + 0.05);

  if (ratio >= minRatio) return; // already passes

  // How much darker do we need? Solve: (1.05) / (targetLum + 0.05) = minRatio
  const targetLum  = 1.05 / minRatio - 0.05;
  const darkFactor = Math.min(1, 1 - targetLum / Math.max(avgLum, 0.001));
  const alpha      = Math.min(0.85, darkFactor * 1.1); // slight buffer

  ctx.fillStyle = `rgba(0,0,0,${alpha.toFixed(3)})`;
  ctx.fillRect(0, 0, width, height);
}

function sRGBLuminance(r: number, g: number, b: number): number {
  const linearise = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}
