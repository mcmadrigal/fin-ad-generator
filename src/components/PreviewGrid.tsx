'use client';

import { useState } from 'react';
import type { AssetSpec } from '@/types';
import { CHANNEL_LABELS, ALL_CHANNELS } from '@/lib/assetSpecs';
import { CanvasAd } from './CanvasAd';
import { DownloadButton } from './DownloadButton';
import { AdLightbox } from './AdLightbox';

interface Props {
  specs:             AssetSpec[];
  text:              string;
  cta:               string;
  backgroundSrc:     string;
  projectName:       string;
  onRegenBackground: () => void;
}

export function PreviewGrid({
  specs, text, cta, backgroundSrc, projectName, onRegenBackground,
}: Props) {
  const [lightboxSpec, setLightboxSpec] = useState<AssetSpec | null>(null);

  // Group specs by channel, preserving channel order
  const byChannel = ALL_CHANNELS.reduce<Record<string, AssetSpec[]>>((acc, ch) => {
    const group = specs.filter(s => s.channel === ch);
    if (group.length > 0) acc[ch] = group;
    return acc;
  }, {});

  const hasSpecs = specs.length > 0;

  return (
    <section>
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between flex-wrap gap-3 mb-8"
        style={{ borderBottom: '1px solid var(--navy-20)', paddingBottom: '1.25rem' }}
      >
        <div>
          <h2
            className="font-display"
            style={{ fontSize: '1.75rem', fontWeight: 300, letterSpacing: '-0.02em', marginBottom: '0.15rem' }}
          >
            Preview
          </h2>
          <p style={{ color: 'var(--navy-40)', fontSize: '0.75rem' }}>
            {specs.length} asset{specs.length !== 1 ? 's' : ''} across {Object.keys(byChannel).length} channel{Object.keys(byChannel).length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            className="btn-secondary"
            onClick={onRegenBackground}
          >
            Next Background
          </button>
          <DownloadButton
            specs={specs}
            text={text}
            cta={cta}
            backgroundSrc={backgroundSrc}
            projectName={projectName}
            disabled={!hasSpecs}
          />
        </div>
      </div>

      {/* ── Channel groups ───────────────────────────────────────────────────── */}
      {Object.entries(byChannel).map(([channel, channelSpecs]) => (
        <div key={channel} className="mb-10">
          <p className="channel-label mb-4">{CHANNEL_LABELS[channel as keyof typeof CHANNEL_LABELS]}</p>
          <div
            style={{
              display:             'grid',
              gap:                 '1rem',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            }}
          >
            {channelSpecs.map(spec => (
              <div key={spec.key} className="preview-card">
                <CanvasAd
                  spec={spec}
                  text={text}
                  cta={cta}
                  backgroundSrc={backgroundSrc}
                  onClick={() => setLightboxSpec(spec)}
                />
                <span className="size-label">{spec.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── Lightbox ─────────────────────────────────────────────────────────── */}
      {lightboxSpec && (
        <AdLightbox
          spec={lightboxSpec}
          text={text}
          cta={cta}
          backgroundSrc={backgroundSrc}
          onClose={() => setLightboxSpec(null)}
        />
      )}
    </section>
  );
}
