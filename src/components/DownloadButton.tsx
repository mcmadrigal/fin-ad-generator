'use client';

import { useState, useCallback } from 'react';
import type { AssetSpec } from '@/types';
import { buildAndDownloadZip } from '@/lib/zipPackager';

interface Props {
  specs:           AssetSpec[];
  text:            string;
  subheadline:     string;
  cta:             string;
  showSubheadline: boolean;
  showCta:         boolean;
  backgroundSrc:   string;
  projectName:     string;
  disabled?:       boolean;
}

export function DownloadButton({
  specs, text, subheadline, cta, showSubheadline, showCta,
  backgroundSrc, projectName, disabled,
}: Props) {
  const [progress,    setProgress]    = useState<{ done: number; total: number } | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleClick = useCallback(async () => {
    if (downloading || specs.length === 0) return;
    setDownloading(true);
    setProgress({ done: 0, total: specs.length * 2 });

    try {
      await buildAndDownloadZip(
        specs.map(spec => ({ spec, text, subheadline, cta, showSubheadline, showCta, backgroundSrc, projectName })),
        (done, total) => setProgress({ done, total }),
      );
    } catch (err) {
      console.error('[DownloadButton] zip failed:', err);
      alert('Download failed. Please try again.');
    } finally {
      setDownloading(false);
      setProgress(null);
    }
  }, [downloading, specs, text, cta, backgroundSrc, projectName]);

  const isDisabled = disabled || downloading || specs.length === 0;
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        className="btn-primary"
        onClick={handleClick}
        disabled={isDisabled}
        style={{ minWidth: '180px', position: 'relative', overflow: 'hidden' }}
      >
        {/* Progress fill bar */}
        {downloading && progress && (
          <span
            aria-hidden
            style={{
              background:  'rgba(0,0,0,0.18)',
              bottom:       0,
              left:         0,
              position:    'absolute',
              top:          0,
              transition:  'width 200ms ease',
              width:       `${pct}%`,
            }}
          />
        )}
        <span style={{ position: 'relative', zIndex: 1 }}>
          {downloading
            ? progress
              ? `Exporting… ${pct}%`
              : 'Preparing…'
            : 'Download All'}
        </span>
      </button>
      {!downloading && specs.length > 0 && (
        <p style={{ color: 'var(--navy-40)', fontSize: '0.7rem' }}>
          {specs.length} size{specs.length !== 1 ? 's' : ''} &times; 2 formats = {specs.length * 2} files
        </p>
      )}
    </div>
  );
}
