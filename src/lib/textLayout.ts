/**
 * Text layout utilities: word-count enforcement, line wrapping, widow/orphan prevention.
 */

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function enforceWordLimit(text: string, max: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, max).join(' ');
}

/** Scale a font dimension to canvas height with min/max clamping */
export function calcFontSize(
  canvasHeight: number,
  multiplier: number,
  min: number,
  max: number,
): number {
  return Math.max(min, Math.min(max, Math.floor(canvasHeight * multiplier)));
}

/**
 * Wrap `text` into lines that fit within `maxWidth` px using the current
 * canvas context font. Returns an array of line strings.
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current !== '') {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  return fixWidowsOrphans(ctx, lines, maxWidth);
}

/**
 * Widow = single word on the last line.
 * Orphan = single word on the first line (less common but still bad).
 * Fix by redistributing words between adjacent lines.
 */
function fixWidowsOrphans(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  maxWidth: number,
): string[] {
  if (lines.length < 2) return lines;

  const result = [...lines];

  // Fix widow on last line
  const last = result[result.length - 1].trim().split(/\s+/);
  if (last.length === 1 && result.length >= 2) {
    const prevWords = result[result.length - 2].trim().split(/\s+/);
    if (prevWords.length > 1) {
      const moved = prevWords.pop()!;
      const newPrev = prevWords.join(' ');
      const newLast = `${moved} ${result[result.length - 1]}`;
      // Only apply if the new last line still fits
      if (ctx.measureText(newLast).width <= maxWidth) {
        result[result.length - 2] = newPrev;
        result[result.length - 1] = newLast;
      }
    }
  }

  // Fix orphan on first line
  const first = result[0].trim().split(/\s+/);
  if (first.length === 1 && result.length >= 2) {
    const nextWords = result[1].trim().split(/\s+/);
    if (nextWords.length > 1) {
      const moved = nextWords.shift()!;
      const newFirst = `${result[0]} ${moved}`;
      if (ctx.measureText(newFirst).width <= maxWidth) {
        result[0] = newFirst;
        result[1] = nextWords.join(' ');
      }
    }
  }

  return result;
}

/** Measure the total pixel height of a text block */
export function textBlockHeight(lineCount: number, lineHeight: number): number {
  return lineCount * lineHeight;
}

/**
 * Word-count-based wrap: distribute words into lines of ≤ maxPerLine words,
 * spread as evenly as possible. Used for any format where the designer wants
 * a hard per-line word cap rather than pixel-width wrapping.
 */
export function wrapPortraitText(text: string, maxPerLine = 4): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const n = words.length;
  if (n === 0) return [];

  const numLines = Math.ceil(n / maxPerLine); // fewest lines that keep each ≤ maxPerLine
  if (numLines <= 1) return [words.join(' ')];

  const base  = Math.floor(n / numLines);
  const extra = n % numLines; // first `extra` lines get one more word

  const lines: string[] = [];
  let i = 0;
  for (let l = 0; l < numLines; l++) {
    const count = l < extra ? base + 1 : base;
    lines.push(words.slice(i, i + count).join(' '));
    i += count;
  }
  return lines;
}
