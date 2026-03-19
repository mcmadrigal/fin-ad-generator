import type { Channel, FormatSpec } from '@/types';

// Stamps _platformKey onto every format entry
function mk(ch: Channel, fmts: Omit<FormatSpec, '_platformKey'>[]): FormatSpec[] {
  return fmts.map(f => ({ ...f, _platformKey: `${ch}_${f.label}` }));
}

export const PLATFORMS: Record<Channel, FormatSpec[]> = {
  TTD: mk('TTD', [
    { label:'160×600',   w:160,  h:600,  spec:{ hl:26, sub:15, cta:10, logoW:35,  padX:22, padY:50, hlSubGap:12, centerText:true, ctaBreak:2, ctaAlign:'center', ctaLineGap:6 } },
    { label:'300×250',   w:300,  h:250,  spec:{ hl:23, sub:0,  cta:10, logoW:31,  padX:24, padY:18, hlSubGap:0,  centerText:true, noSub:true } },
    { label:'728×90',    w:728,  h:90,   spec:{ hl:26, noSub:true, noCta:true, forceCenter:true, forceLines:2 } },
    { label:'300×600',   w:300,  h:600,  spec:{ hl:35, sub:20, cta:16, logoW:60,  padX:33, padY:50, hlSubGap:19, centerText:true, ctaAlign:'center' } },
    { label:'320×50',    w:320,  h:50,   spec:{ hl:14, noSub:true, noCta:true, forceCenter:true, forceLines:2 } },
    { label:'300×50',    w:300,  h:50,   spec:{ hl:14, noSub:true, noCta:true, forceCenter:true, forceLines:2 } },
    { label:'768×1024',  w:768,  h:1024, spec:{ hl:74, sub:42, cta:24, logoW:100, pad:70,  hlSubGap:42, centerText:true } },
    { label:'1024×768',  w:1024, h:768,  spec:{ hl:74, sub:42, cta:24, logoW:100, pad:70,  hlSubGap:41, centerText:true } },
    { label:'320×480',   w:320,  h:480,  spec:{ hl:33, sub:19, cta:11, logoW:44,  pad:31,  hlSubGap:18, centerText:true } },
    { label:'970×250',   w:970,  h:250,  spec:{ hl:41, sub:0,  cta:22, logoW:56,  pad:39,  hlSubGap:0,  noSub:true, layout:'corners', forceLines:2 } },
    { label:'480×320',   w:480,  h:320,  spec:{ hl:33, sub:19, cta:11, logoW:44,  pad:31,  hlSubGap:16, centerText:true, minWordsPerLine:4 } },
  ]),
  LinkedIn: mk('LinkedIn', [
    { label:'1080×1080', w:1080, h:1080, spec:{ hl:90,  sub:51, cta:29, logoW:122, pad:85,  hlSubGap:43, centerText:true, minWordsPerLine:4, maxWordsPerLine:6, noSubOrphan:true } },
    { label:'1080×1350', w:1080, h:1350, spec:{ hl:101, sub:57, cta:33, logoW:136, pad:95,  hlSubGap:48, centerText:true, minWordsPerLine:4, maxWordsPerLine:6, noSubOrphan:true } },
    { label:'1200×1200', w:1200, h:1200, spec:{ hl:100, sub:57, cta:32, logoW:135, pad:95,  hlSubGap:48, centerText:true, minWordsPerLine:4, maxWordsPerLine:6, noSubOrphan:true } },
  ]),
  '6Sense': mk('6Sense', [
    { label:'1200×628',  w:1200, h:628,  spec:{ hl:70,  sub:38, cta:32, logoW:96,  pad:48,  hlSubGap:32, centerText:true, minWordsPerLine:4, maxWordsPerLine:6, noSubOrphan:true, forceLines:2 } },
    { label:'300×250',   w:300,  h:250,  spec:{ hl:23,  sub:0,  cta:10, logoW:31,  padX:24, padY:18, hlSubGap:0, centerText:true, noSub:true } },
    { label:'728×90',    w:728,  h:90,   spec:{ hl:26,  noSub:true, noCta:true, forceCenter:true, forceLines:2 } },
  ]),
  Meta: mk('Meta', [
    { label:'1080×1080', w:1080, h:1080, spec:{ hl:90,  sub:51, cta:29, logoW:122, pad:85,  hlSubGap:43, centerText:true } },
    { label:'1080×1920', w:1080, h:1920, spec:{ hl:120, sub:68, cta:39, logoW:162, pad:114, hlSubGap:58, centerText:true } },
    { label:'1920×1080', w:1920, h:1080, spec:{ hl:112, sub:61, cta:52, logoW:154, pad:72,  hlSubGap:50, centerText:true, minWordsPerLine:4, maxWordsPerLine:6, noSubOrphan:true, forceLines:2 } },
  ]),
};

export const ALL_CHANNELS: Channel[] = ['TTD', 'LinkedIn', '6Sense', 'Meta'];

export function getAllFormatKeys(): string[] {
  const keys: string[] = [];
  for (const [platform, fmts] of Object.entries(PLATFORMS)) {
    for (const f of fmts) {
      keys.push(f._platformKey || platform + '_' + f.label);
    }
  }
  return keys;
}
