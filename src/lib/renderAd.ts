/**
 * Fin Ad Render Engine — ported from fin-ad-generator.html
 *
 * renderAd(f, state) returns an HTML string that can be set via
 * dangerouslySetInnerHTML on a positioned container of f.w × f.h px.
 * Scale the container with CSS transform:scale() for preview display.
 */

import type { FormatSpec, AppState } from '@/types';
import { BACKGROUNDS } from './backgrounds';

// ─── LOGO SVG ─────────────────────────────────────────────────────────────────
export const LOGO_SVG = `<svg viewBox="0 0 208 122" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;"><path d="M126.391 121.536V34.0504H147.63V47.5356C150.552 43.0406 154.429 39.4445 159.261 36.7475C164.093 34.0504 169.544 32.7019 175.612 32.7019C181.905 32.7019 187.412 33.9942 192.131 36.5789C196.964 39.1636 200.672 42.8158 203.257 47.5356C205.954 52.2555 207.302 57.8181 207.302 64.2236V121.536H186.232V69.112C186.232 63.9427 184.715 59.7285 181.68 56.4696C178.646 53.2107 174.544 51.5812 169.375 51.5812C164.768 51.5812 160.834 52.8174 157.575 55.2897C154.316 57.7619 151.844 61.358 150.158 66.0778C148.473 70.7977 147.63 76.4727 147.63 83.1029V121.536H126.391Z" fill="currentColor"/><path d="M90.0898 121.536V34.0502H111.329V121.536H90.0898ZM90.0898 20.1435V0H111.076V20.1435H90.0898Z" fill="currentColor"/><path d="M0 121.536V0H81.586V19.7221H22.5879V48.7154H70.2921V68.606H22.5879V121.536H0Z" fill="currentColor"/></svg>`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MAX_PX = 260;

// ─── BACKGROUND STYLE ────────────────────────────────────────────────────────
export function getBgStyle(bgs: typeof BACKGROUNDS, bgIdx: number): string {
  const bg = bgs[bgIdx] || bgs[0];
  if (bg.v.startsWith('solid:')) return 'background:' + bg.v.replace('solid:', '') + ';';
  return "background:#000 url('" + bg.v + "') center/cover no-repeat;";
}

// ─── TEXT MEASUREMENT ─────────────────────────────────────────────────────────
function measureTextWidth(text: string, fontPx: number, family: string): number {
  if (typeof document === 'undefined') return text.length * fontPx * 0.55;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = fontPx + 'px ' + family;
  return ctx.measureText(text).width;
}

function fitFontSize(lines: string[], availW: number, family: string, minPx: number, maxPx: number): number {
  if (!lines.length) return minPx;
  let lo = minPx, hi = maxPx;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const maxW = Math.max(...lines.map(l => measureTextWidth(l, mid, family)));
    if (maxW < availW * 0.9) lo = mid; else hi = mid;
  }
  return Math.floor(lo);
}

// ─── DP LINE BALANCER ─────────────────────────────────────────────────────────
// Balance text into lines using DP — minimises width variance for a rectangular rag.
function balanceLines(
  text: string,
  availW: number,
  startPx: number,
  family: string,
  maxLines: number,
  minPx?: number,
  minWordsPerLine?: number,
  maxWordsPerLine?: number,
  minLines?: number,
): { lines: string[]; fontSize: number } {
  if (!text.trim()) return { lines: [], fontSize: startPx };
  const words = text.trim().split(/\s+/);
  const n = words.length;
  if (n === 1) return { lines: [text.trim()], fontSize: startPx };

  function buildWidths(px: number): number[][] {
    if (typeof document === 'undefined') {
      // SSR fallback: approximate widths
      const w: number[][] = [];
      for (let i = 0; i < n; i++) {
        w[i] = [];
        let acc = 0;
        for (let j = i; j < n; j++) {
          acc += (j === i ? 0 : px * 0.3) + words[j].length * px * 0.55;
          w[i][j] = acc;
        }
      }
      return w;
    }
    const cache = document.createElement('canvas').getContext('2d')!;
    cache.font = px + 'px ' + family;
    const w: number[][] = [];
    for (let i = 0; i < n; i++) {
      w[i] = [];
      let acc = 0;
      for (let j = i; j < n; j++) {
        acc += (j === i ? 0 : cache.measureText(' ').width) + cache.measureText(words[j]).width;
        w[i][j] = acc;
      }
    }
    return w;
  }

  function dpSplit(widths: number[][], k: number, targetW: number): string[] | null {
    const INF = 1e15;
    const dp  = Array.from({ length: n }, () => new Float64Array(k + 1).fill(INF));
    const par = Array.from({ length: n }, () => new Int16Array(k + 1).fill(-1));
    for (let j = 0; j < n; j++) {
      const d = widths[0][j] - targetW;
      dp[j][1] = d * d;
    }
    for (let line = 2; line <= k; line++) {
      for (let j = line - 1; j < n; j++) {
        for (let i = line - 1; i <= j; i++) {
          const d = widths[i][j] - targetW;
          const cost = dp[i - 1][line - 1] + d * d;
          if (cost < dp[j][line]) { dp[j][line] = cost; par[j][line] = i; }
        }
      }
    }
    if (dp[n - 1][k] === INF) return null;
    const breaks: number[] = [];
    let pos = n - 1, l = k;
    while (l > 1) { const s = par[pos][l]; breaks.unshift(s); pos = s - 1; l--; }
    breaks.unshift(0);
    const lines: string[] = [];
    for (let b = 0; b < breaks.length; b++) {
      const end = b < breaks.length - 1 ? breaks[b + 1] - 1 : n - 1;
      lines.push(words.slice(breaks[b], end + 1).join(' '));
    }
    return lines;
  }

  let fontSize = startPx;
  const floor = minPx || Math.max(10, Math.round(startPx * 0.55));

  while (fontSize >= floor) {
    const widths = buildWidths(fontSize);
    const totalW = widths[0][n - 1];
    const candidateTargets = [availW * 0.92, availW * 0.80, availW * 0.70];
    let best: string[] | null = null, bestScore = Infinity;

    for (let k = (minLines || 1); k <= maxLines; k++) {
      const targets = [...candidateTargets, totalW / k];
      for (const targetW of targets) {
        const lines = dpSplit(widths, k, targetW);
        if (!lines) continue;
        if (lines.some(l => l.trim().split(/\s+/).length === 1 && lines.length > 1)) continue;
        if (minWordsPerLine && lines.length > 1 && lines.some(l => l.trim().split(/\s+/).length < minWordsPerLine)) continue;
        if (maxWordsPerLine && lines.some(l => l.trim().split(/\s+/).length > maxWordsPerLine)) continue;
        if (lines.length > 1 && lines[lines.length - 1].trim().split(/\s+/).length === 1) continue;
        if (typeof document !== 'undefined') {
          const ctx2 = document.createElement('canvas').getContext('2d')!;
          ctx2.font = fontSize + 'px ' + family;
          const lws = lines.map(l => ctx2.measureText(l).width);
          const maxW = Math.max(...lws);
          if (maxW > availW) continue;
          const avg = lws.reduce((a, b) => a + b, 0) / lws.length;
          const variance = lws.reduce((a, w) => a + (w - avg) ** 2, 0);
          if (variance < bestScore) { bestScore = variance; best = lines; }
        } else {
          best = lines;
          break;
        }
      }
    }

    if (best) return { lines: best, fontSize: Math.floor(fontSize) };
    fontSize -= 1;
  }
  return { lines: [text.trim()], fontSize: floor };
}

function breakWords(
  text: string, availW: number, startPx: number, minPx: number,
  minWordsPerLine?: number, maxWordsPerLine?: number,
): { lines: string[]; fontSize: number } {
  return balanceLines(text, availW, startPx, 'Saans', 4, minPx, minWordsPerLine, maxWordsPerLine);
}

// Break subhead into groups of 4-6 words per line — hard rule, not DP balanced
function breakSubGroups(text: string, noOrphan?: boolean): string[] {
  if (!text.trim()) return [];
  const words = text.trim().split(/\s+/);
  const n = words.length;
  if (n <= 6) return [words.join(' ')];
  const lines: string[] = [];
  let i = 0;
  while (i < n) {
    const rem = n - i;
    let gs: number;
    if (rem <= 6) {
      gs = rem;
    } else {
      gs = 5;
      if (rem - gs === 1) gs = 4;
    }
    lines.push(words.slice(i, i + gs).join(' '));
    i += gs;
  }
  while (lines.length > 1 && lines[lines.length - 1].trim().split(/\s+/).length === 1) {
    const orphan = lines.pop()!;
    lines[lines.length - 1] += ' ' + orphan;
  }
  return lines;
}

function breakSub(
  text: string, availW: number, startPx: number, minPx: number, noOrphan?: boolean,
): { lines: string[]; fontSize: number } {
  const groups = breakSubGroups(text, noOrphan);
  if (!groups.length) return { lines: [], fontSize: startPx };
  const floor = minPx || Math.max(10, Math.round(startPx * 0.55));
  if (typeof document !== 'undefined') {
    for (let sz = startPx; sz >= floor; sz--) {
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.font = sz + 'px Saans';
      const maxW = Math.max(...groups.map(l => ctx.measureText(l).width));
      if (maxW <= availW) return { lines: groups, fontSize: sz };
    }
  }
  return { lines: groups, fontSize: floor };
}

function breakCtaLines(text: string, wordsPerLine: number): string[] {
  if (!text || !wordsPerLine) return [text];
  const words = text.trim().split(/\s+/);
  if (words.length <= wordsPerLine) return [words.join(' ')];
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    lines.push(words.slice(i, i + wordsPerLine).join(' '));
  }
  if (lines.length > 1 && lines[lines.length - 1].trim().split(/\s+/).length === 1) {
    const orphan = lines.pop()!;
    lines[lines.length - 1] += ' ' + orphan;
  }
  return lines;
}

// Parse <b> tags into Saans SemiBold spans for ad rendering
export function parseBold(text: string): string {
  if (!text) return '';
  return text.replace(/<b>(.*?)<\/b>/gi, (_m, inner: string) =>
    '<span style="font-family:Saans,sans-serif;font-weight:600;">' + inner + '</span>',
  );
}

// ─── MAIN RENDER FUNCTION ────────────────────────────────────────────────────
export function renderAd(f: FormatSpec, state: AppState, bgs = BACKGROUNDS): string {
  const W = f.w, H = f.h;
  const tc = '#FAF9F6';
  const bg = getBgStyle(bgs, state.bgIdx);
  const overlayOpacity = (state.overlayOpacity || 0) / 100;
  const overlayHtml = overlayOpacity > 0
    ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,${overlayOpacity.toFixed(3)});z-index:1;pointer-events:none;"></div>`
    : '';
  const ctaStyleTag = `<style>.fin-cta{text-decoration:underline;text-underline-offset:0.15em;text-decoration-color:${tc};}</style>`;
  const isStrip = H <= 100;
  const spec = f.spec || null;
  const ta = state.align;
  const alignStyle = 'text-align:' + ta + ';';
  const itemsAlign = ta === 'center' ? 'align-items:center;' : 'align-items:flex-start;';

  const padX = spec && spec.padX != null ? spec.padX : (spec && spec.pad != null ? spec.pad : Math.round(W * 0.055));
  const padY = spec && spec.padY != null ? spec.padY : (spec && spec.pad != null ? spec.pad : Math.round(H * (isStrip ? 0.08 : 0.06)));
  const availW = W - padX * 2;

  let logoW: number, logoH: number;
  const LOGO_RATIO = 208 / 122;
  if (spec && spec.logoW != null) {
    logoW = spec.logoW;
    logoH = Math.round(logoW / LOGO_RATIO);
  } else if (spec && spec.logoH != null) {
    logoH = spec.logoH;
    logoW = Math.round(logoH * LOGO_RATIO);
  } else {
    logoH = Math.max(16, Math.min(Math.round(W * 0.065), 44));
    logoW = Math.round(logoH * LOGO_RATIO);
  }

  // ── STRIP LAYOUT ───────────────────────────────────────────────────────────
  if (isStrip) {
    const showStripCta = !(spec && spec.noCta);
    const ctaSz = spec ? (spec.cta || 0) : Math.max(9, Math.round(H * 0.3));
    const ctaReserve = showStripCta ? Math.round(W * 0.18) : 0;
    const hlAvailW = W - logoW - padX * 3 - ctaReserve;
    const stripMaxLines = (spec && spec.forceLines) ? spec.forceLines : 2;
    const stripAlign = (spec && spec.forceCenter) ? 'center' : ta;
    const hlAvailH = H - padY * 2;
    const hlSzStart = spec ? spec.hl! : Math.max(7, Math.round(H * 0.42));
    const hlFloor = 7;
    let hlSzFinal = hlFloor, hlResultFinal: { lines: string[]; fontSize: number } | null = null;

    if (typeof document !== 'undefined') {
      for (let sz = hlSzStart; sz >= hlFloor; sz--) {
        const res = balanceLines(state.headline, hlAvailW, sz, 'Saans', stripMaxLines, sz);
        const measCanvas = document.createElement('canvas').getContext('2d')!;
        measCanvas.font = sz + 'px Saans';
        const maxLineW = Math.max(...res.lines.map(l => measCanvas.measureText(l).width));
        const blockH = res.lines.length * sz * 1.1;
        if (maxLineW <= hlAvailW && blockH <= hlAvailH) {
          hlSzFinal = sz; hlResultFinal = res; break;
        }
      }
    }
    if (!hlResultFinal) hlResultFinal = balanceLines(state.headline, hlAvailW, hlFloor, 'Saans', stripMaxLines, hlFloor);
    const hlSz = hlSzFinal;
    let hlLines = hlResultFinal.lines;

    if (spec && spec.forceLines && hlLines.length < spec.forceLines) {
      const words = state.headline.trim().split(/\s+/);
      const mid = Math.ceil(words.length / 2);
      hlLines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')].filter(Boolean);
    }
    const hlLineH = hlSz * 1.1;
    const hlHTML = hlLines.map(l => `<span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${l}</span>`).join('');
    const ctaRaw = (state.cta || '').toUpperCase();
    const stripCtaHTML = `<div style="white-space:nowrap;"><span class="fin-cta">${ctaRaw}</span></div>`;

    return `${ctaStyleTag}<div style="position:absolute;inset:0;${bg}"></div>${overlayHtml}
<div style="position:absolute;inset:0;z-index:2;display:flex;align-items:center;padding:0 ${padX}px;gap:${Math.round(padX * 0.6)}px;">
  <div style="flex-shrink:0;width:${logoW}px;height:${logoH}px;color:${tc};">${LOGO_SVG}</div>
  <div style="flex:1;min-width:0;font-family:'Saans',sans-serif;font-size:${hlSz}px;line-height:${hlLineH}px;color:${tc};overflow:hidden;text-align:${stripAlign};">${hlHTML}</div>
  ${showStripCta ? `<div style="flex-shrink:0;font-family:'SaansMono',monospace;font-size:${ctaSz}px;letter-spacing:0.05em;color:${tc};">${stripCtaHTML}</div>` : ''}
</div>`;
  }

  // ── STANDARD LAYOUT ────────────────────────────────────────────────────────
  let hlSz: number, subSz: number, ctaSz: number;
  if (spec) {
    hlSz  = spec.hl!;
    subSz = spec.sub!;
    ctaSz = spec.cta!;
  } else {
    hlSz  = fitFontSize([state.headline], availW, 'Saans', 12, 180);
    subSz = Math.max(12, Math.round(hlSz * 0.44));
    ctaSz = Math.max(11, Math.min(Math.round(W * 0.028), 18));
  }

  const hlFloor   = Math.max(10, Math.round(hlSz * 0.55));
  const subSzSafe = subSz || 12;
  const subFloor  = Math.max(10, Math.round(subSzSafe * 0.55));
  const hlMinWords = (spec && spec.minWordsPerLine) ? spec.minWordsPerLine : undefined;
  const hlMaxWords = (spec && spec.maxWordsPerLine) ? spec.maxWordsPerLine : undefined;
  const hlForceLines = (spec && spec.forceLines) ? spec.forceLines : null;

  let hlResult: { lines: string[]; fontSize: number };

  if (hlForceLines && !isStrip) {
    const _fw = state.headline.trim().split(/\s+/);
    const _fper = Math.ceil(_fw.length / hlForceLines);
    let _flines: string[] = [];
    for (let i = 0; i < hlForceLines; i++) {
      const chunk = _fw.slice(i * _fper, (i + 1) * _fper);
      if (chunk.length) _flines.push(chunk.join(' '));
    }
    while (_flines.length < hlForceLines && _flines.length > 0) {
      let li = 0;
      _flines.forEach((l, i) => { if (l.split(' ').length > _flines[li].split(' ').length) li = i; });
      const sw = _flines[li].split(' ');
      const sm = Math.ceil(sw.length / 2);
      _flines.splice(li, 1, sw.slice(0, sm).join(' '), sw.slice(sm).join(' '));
    }
    _flines = _flines.slice(0, hlForceLines);
    while (_flines.length > 1 && _flines[_flines.length - 1].split(/\s+/).length === 1) {
      const orph = _flines.pop()!;
      _flines[_flines.length - 1] += ' ' + orph;
    }
    let _fsz = hlFloor;
    if (typeof document !== 'undefined') {
      for (let sz = hlSz; sz >= hlFloor; sz--) {
        const _ctx = document.createElement('canvas').getContext('2d')!;
        _ctx.font = sz + 'px Saans';
        if (Math.max(..._flines.map(l => _ctx.measureText(l).width)) <= availW) { _fsz = sz; break; }
      }
    }
    hlResult = { lines: _flines, fontSize: _fsz };
  } else if (hlMinWords || hlMaxWords) {
    const _w = state.headline.trim().split(/\s+/);
    const _per = Math.ceil(_w.length / 3);
    let _lines = [
      _w.slice(0, _per).join(' '),
      _w.slice(_per, _per * 2).join(' '),
      _w.slice(_per * 2).join(' '),
    ].filter(l => l.trim().length > 0);
    while (_lines.length < 3) {
      let li = 0;
      _lines.forEach((l, i) => { if (l.split(' ').length > _lines[li].split(' ').length) li = i; });
      const sw = _lines[li].split(' ');
      const sm = Math.ceil(sw.length / 2);
      _lines.splice(li, 1, sw.slice(0, sm).join(' '), sw.slice(sm).join(' '));
    }
    _lines = _lines.slice(0, 3);
    while (_lines.length > 1 && _lines[_lines.length - 1].split(/\s+/).length === 1) {
      const orph = _lines.pop()!;
      _lines[_lines.length - 1] += ' ' + orph;
    }
    let _bestSz = hlFloor;
    if (typeof document !== 'undefined') {
      for (let sz = hlSz; sz >= hlFloor; sz--) {
        const _ctx = document.createElement('canvas').getContext('2d')!;
        _ctx.font = sz + 'px Saans';
        if (Math.max(..._lines.map(l => _ctx.measureText(l).width)) <= availW) { _bestSz = sz; break; }
      }
    }
    hlResult = { lines: _lines, fontSize: _bestSz };
  } else {
    hlResult = breakWords(state.headline, availW, hlSz, hlFloor, hlMinWords, hlMaxWords);
  }

  const subResult = breakSub(state.sub || '', availW, subSzSafe, subFloor, spec && spec.noSubOrphan);
  const hlLines   = hlResult.lines;
  const subLines2 = subResult.lines;
  hlSz  = Math.min(hlSz,  hlResult.fontSize);
  subSz = subSz ? Math.min(subSzSafe, subResult.fontSize) : 0;

  const hlSubGap  = spec && spec.hlSubGap != null ? spec.hlSubGap : Math.round(hlSz * 0.25);
  const subCtaGap = Math.round(ctaSz * 1.6);
  const hlLineH   = hlSz  * 1.1;
  const subLineH  = subSz * 1.4;
  const hlTotalH  = hlLineH * hlLines.length;

  const usedH  = logoH + padY * 2 + hlTotalH + ctaSz * 2.5 + padY;
  const showSub = !!(spec && spec.noSub) ? false : state.showSub && (spec ? true : (usedH + subLineH * 2 < H * 0.92));

  const ctaRaw = (state.cta || '').toUpperCase();
  const ctaLines = (spec && spec.ctaBreak) ? breakCtaLines(ctaRaw, spec.ctaBreak) : [ctaRaw];
  const ctaLineGap = (spec && spec.ctaLineGap) ? spec.ctaLineGap : 0;
  const ctaAlignOverride = (spec && spec.ctaAlign) ? spec.ctaAlign : ta;
  const ctaAlignStyle = 'text-align:' + ctaAlignOverride + ';';
  const ctaHTML = ctaLines.map((l, i) =>
    `<div style="white-space:nowrap;${ctaAlignStyle}${i < ctaLines.length - 1 && ctaLineGap ? 'margin-bottom:' + ctaLineGap + 'px;' : ''}"><span class="fin-cta">${l}</span></div>`,
  ).join('');
  const hlHTML   = hlLines.map(l => `<div style="white-space:nowrap;${alignStyle}">${l}</div>`).join('');
  const subHTML  = subLines2.map(l => `<div style="overflow-wrap:break-word;word-break:break-word;${alignStyle}">${parseBold(l)}</div>`).join('');

  // ── CORNERS LAYOUT ─────────────────────────────────────────────────────────
  if (spec && spec.layout === 'corners') {
    const cornersCtaRaw = (state.cta || '').toUpperCase();
    let cornersHlLines = hlLines;
    if (spec.forceLines && !isStrip) {
      const _fw = state.headline.trim().split(/\s+/);
      const _n = spec.forceLines;
      const _fper = Math.ceil(_fw.length / _n);
      let _fl: string[] = [];
      for (let i = 0; i < _n; i++) {
        const chunk = _fw.slice(i * _fper, (i + 1) * _fper);
        if (chunk.length) _fl.push(chunk.join(' '));
      }
      while (_fl.length < _n && _fl.length > 0) {
        let li = 0;
        _fl.forEach((l, i) => { if (l.split(' ').length > _fl[li].split(' ').length) li = i; });
        const sw = _fl[li].split(' ');
        const sm = Math.ceil(sw.length / 2);
        _fl.splice(li, 1, sw.slice(0, sm).join(' '), sw.slice(sm).join(' '));
      }
      while (_fl.length > 1 && _fl[_fl.length - 1].split(/\s+/).length === 1) {
        const orph = _fl.pop()!; _fl[_fl.length - 1] += ' ' + orph;
      }
      cornersHlLines = _fl.slice(0, _n);
      if (typeof document !== 'undefined') {
        let _fsz = hlFloor;
        for (let sz = hlSz; sz >= hlFloor; sz--) {
          const _ctx = document.createElement('canvas').getContext('2d')!;
          _ctx.font = sz + 'px Saans';
          if (Math.max(...cornersHlLines.map(l => _ctx.measureText(l).width)) <= availW * 0.6) { _fsz = sz; break; }
        }
        hlSz = _fsz;
      }
    }
    const ctaLines2 = (spec && spec.ctaBreak) ? breakCtaLines(cornersCtaRaw, spec.ctaBreak) : [cornersCtaRaw];
    const ctaLineGap2 = (spec && spec.ctaLineGap) ? spec.ctaLineGap : 0;
    const ctaHTML2 = ctaLines2.map((l, i) =>
      `<div style="white-space:nowrap;${i < ctaLines2.length - 1 && ctaLineGap2 ? 'margin-bottom:' + ctaLineGap2 + 'px;' : ''}"><span class="fin-cta">${l}</span></div>`,
    ).join('');
    const capRatio = 0.71;
    const hlLeading = (hlSz * 1.1 - hlSz) / 2;
    const capNudge = -(hlLeading + (1 - capRatio) * hlSz);
    const logoCapNudge = capNudge;
    const cornersHlHTML = cornersHlLines.map(l => `<div style="overflow-wrap:break-word;">${parseBold(l)}</div>`).join('');

    return `${ctaStyleTag}<div style="position:absolute;inset:0;${bg}"></div>${overlayHtml}
<div style="position:absolute;inset:0;z-index:2;overflow:hidden;">
  <div style="position:absolute;top:${padY}px;left:${padX}px;max-width:${availW * 0.6}px;margin-top:${capNudge.toFixed(1)}px;">
    <div style="font-family:'Saans',sans-serif;font-size:${hlSz}px;line-height:1.1;color:${tc};">${cornersHlHTML}</div>
  </div>
  <div style="position:absolute;top:${padY}px;right:${padX}px;width:${logoW}px;height:${logoH}px;color:${tc};margin-top:${logoCapNudge.toFixed(1)}px;">
    ${LOGO_SVG}
  </div>
  <div style="position:absolute;bottom:${padY}px;left:${padX}px;font-family:'SaansMono',monospace;font-size:${ctaSz}px;letter-spacing:0.05em;text-transform:uppercase;color:${tc};">
    ${ctaHTML2}
  </div>
</div>`;
  }

  // ── CENTER TEXT LAYOUT ─────────────────────────────────────────────────────
  if (spec && spec.centerText) {
    return `${ctaStyleTag}<div style="position:absolute;inset:0;${bg}"></div>${overlayHtml}
<div style="position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;${itemsAlign}padding:${padY}px ${padX}px;overflow:hidden;">
  <div style="flex-shrink:0;width:${logoW}px;height:${logoH}px;color:${tc};">${LOGO_SVG}</div>
  <div style="flex:1;display:flex;flex-direction:column;${itemsAlign}justify-content:center;width:100%;min-height:0;overflow:hidden;">
    <div style="font-family:'Saans',sans-serif;font-size:${hlSz}px;line-height:1.1;color:${tc};margin-bottom:${hlSubGap}px;width:100%;max-width:${availW}px;">${hlHTML}</div>
    ${showSub && state.sub ? `<div style="font-family:'Saans',sans-serif;font-size:${subSz}px;line-height:1.2;color:${tc};opacity:0.78;width:100%;max-width:${availW}px;">${subHTML}</div>` : ''}
  </div>
  <div style="flex-shrink:0;width:100%;max-width:${availW}px;">
    <div style="font-family:'SaansMono',monospace;font-size:${ctaSz}px;letter-spacing:0.05em;text-transform:uppercase;color:${tc};line-height:${1.2 + (ctaLineGap / ctaSz).toFixed(3)};">${ctaHTML}</div>
  </div>
</div>`;
  }

  // ── DEFAULT LAYOUT ─────────────────────────────────────────────────────────
  return `${ctaStyleTag}<div style="position:absolute;inset:0;${bg}"></div>${overlayHtml}
<div style="position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;overflow:hidden;">
  <div style="padding:${padY}px ${padX}px;flex-shrink:0;">
    <div style="width:${logoW}px;height:${logoH}px;color:${tc};">${LOGO_SVG}</div>
  </div>
  <div style="flex:1;padding:0 ${padX}px;display:flex;flex-direction:column;${itemsAlign}justify-content:flex-end;padding-bottom:${padY}px;width:100%;min-height:0;overflow:hidden;">
    <div style="font-family:'Saans',sans-serif;font-size:${hlSz}px;line-height:1.1;color:${tc};margin-bottom:${hlSubGap}px;width:100%;max-width:${availW}px;">${hlHTML}</div>
    ${showSub && state.sub ? `<div style="font-family:'Saans',sans-serif;font-size:${subSz}px;line-height:1.2;color:${tc};opacity:0.78;margin-bottom:${subCtaGap}px;width:100%;max-width:${availW}px;">${subHTML}</div>` : `<div style="margin-bottom:${subCtaGap}px;"></div>`}
    <div style="font-family:'SaansMono',monospace;font-size:${ctaSz}px;letter-spacing:0.05em;text-transform:uppercase;color:${tc};width:100%;max-width:${availW}px;">${ctaHTML}</div>
  </div>
</div>`;
}

// ─── RESTRICTION HELPERS ──────────────────────────────────────────────────────
export function getRestrictions(f: FormatSpec): string[] {
  const isStrip = f.h <= 100;
  const spec = f.spec || null;
  const notes: string[] = [];
  if (isStrip || (spec && spec.noSub)) notes.push('Subheadline not shown — too small for this format');
  if (isStrip || (spec && spec.noCta)) notes.push('CTA not shown — would crowd this format');
  return notes.filter((n, i) => notes.indexOf(n) === i);
}

// ─── WORD COUNTING ────────────────────────────────────────────────────────────
export function wordCount(s: string): number {
  return s.trim() === '' ? 0 : s.trim().split(/\s+/).length;
}

// ─── SANITIZE RICH HTML (contenteditable → render-ready) ─────────────────────
export function sanitizeRichHTML(html: string): string {
  if (typeof document === 'undefined') return html;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  function walk(node: ChildNode): string {
    if (node.nodeType === 3) return (node as Text).textContent || '';
    if (node.nodeType !== 1) return '';
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const style = el.getAttribute('style') || '';
    const isBold = tag === 'b' || tag === 'strong' ||
                   /font-weight\s*:\s*(bold|700|600)/i.test(style);
    const inner = Array.from(node.childNodes).map(walk).join('');
    if (tag === 'br') return ' ';
    if (tag === 'div' || tag === 'p') return inner + ' ';
    return isBold ? '<b>' + inner + '</b>' : inner;
  }
  return Array.from(tmp.childNodes).map(walk).join('').trim();
}

// ─── PREVIEW SCALE ────────────────────────────────────────────────────────────
export const PREVIEW_MAX_PX = MAX_PX;

export function calcPreviewScale(w: number, h: number): number {
  return Math.min(PREVIEW_MAX_PX / w, PREVIEW_MAX_PX / h, 1);
}
