export type Channel = 'TTD' | 'LinkedIn' | '6Sense' | 'Meta';

export type Align = 'left' | 'center';

export interface FormatSpec {
  label:         string;
  w:             number;
  h:             number;
  _platformKey?: string;  // e.g. "TTD_300×600" — used for per-format copy overrides
  spec: {
    hl?:              number;
    sub?:             number;
    cta?:             number;
    logoW?:           number;
    logoH?:           number;
    pad?:             number;
    padX?:            number;
    padY?:            number;
    hlSubGap?:        number;
    centerText?:      boolean;
    noSub?:           boolean;
    noCta?:           boolean;
    forceCenter?:     boolean;
    forceLines?:      number;
    minWordsPerLine?: number;
    maxWordsPerLine?: number;
    noSubOrphan?:     boolean;
    ctaBreak?:        number;
    ctaAlign?:        'left' | 'center';
    ctaLineGap?:      number;
    layout?:          'corners';
  };
}

export interface Background {
  label: string;
  /** Either "solid:#rrggbb" or a URL path like "/images/..." */
  v: string;
}

export interface AppState {
  headline:        string;
  sub:             string;  // HTML string (may contain <b> tags)
  cta:             string;
  bgIdx:           number;
  align:           Align;
  showSub:         boolean;
  selected:        Set<string>;
  campaign:        string;
  overlayOpacity:  number;
  formatOverrides: Record<string, { hl?: string; cta?: string }>;
}

export interface FormState {
  projectName:  string;
  text:         string;
  cta:          string;
  selectedKeys: Set<string>;
  backgroundSrc: string;
}
