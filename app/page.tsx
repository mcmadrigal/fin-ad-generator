'use client';

import { useState, useCallback } from 'react';
import type { FormState } from '@/types';
import type { AssetSpec } from '@/types';
import { getAllSpecs } from '@/lib/assetSpecs';
import { BG_IMAGES } from '@/lib/bgImages';
import { AdGeneratorForm } from '@/components/AdGeneratorForm';
import { PreviewGrid } from '@/components/PreviewGrid';

// GeneratedState holds everything that changes only on Generate click.
// Text and CTA are tracked separately so previews update live as the user types.
interface GeneratedState {
  specs:         AssetSpec[];
  backgroundSrc: string;
  projectName:   string;
}

export default function HomePage() {
  // Live copy state — drives preview immediately as the user types
  const [text, setText] = useState('');
  const [cta,  setCta]  = useState('');

  const [generating, setGenerating] = useState(false);
  const [generated,  setGenerated]  = useState<GeneratedState | null>(null);

  const handleGenerate = useCallback(async (form: FormState) => {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 20)); // flush button state

    const allSpecs    = getAllSpecs();
    const activeSpecs = allSpecs.filter(s => form.selectedKeys.has(s.key));

    setGenerated({
      specs:         activeSpecs,
      backgroundSrc: form.backgroundSrc,
      projectName:   form.projectName,
    });
    setGenerating(false);

    setTimeout(() => {
      document.getElementById('preview-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 120);
  }, []);

  const handleRegenBackground = useCallback(() => {
    setGenerated(prev => {
      if (!prev) return prev;
      const idx  = BG_IMAGES.findIndex(b => b.src === prev.backgroundSrc);
      const next = BG_IMAGES[(idx + 1) % BG_IMAGES.length];
      return { ...prev, backgroundSrc: next.src };
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{ borderBottom: '1px solid var(--navy-20)', padding: '1.25rem 2rem' }}>
        <div style={{
          alignItems: 'center',
          display: 'flex',
          gap: '1.25rem',
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/lockup_white.svg"
            alt="Fin"
            style={{ height: '22px', width: 'auto', flexShrink: 0 }}
          />
          <div style={{ height: '18px', width: '1px', background: 'var(--navy-20)', flexShrink: 0 }} aria-hidden />
          <span style={{
            color: 'var(--navy-40)', fontSize: '0.75rem', fontWeight: 500,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Ad Generator
          </span>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main style={{
        display: 'grid',
        flex: '1',
        gridTemplateColumns: generated ? '360px 1fr' : '1fr',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0',
        width: '100%',
      }}>
        {/* Form panel */}
        <aside style={{
          borderRight: generated ? '1px solid var(--navy-20)' : 'none',
          overflowY: 'auto',
          padding: '2.5rem 2rem',
          position: generated ? 'sticky' : 'static',
          top: '0',
          alignSelf: 'start',
          maxHeight: generated ? '100vh' : 'none',
        }}>
          {!generated && (
            <div style={{ maxWidth: '480px', margin: '0 auto 2.5rem' }}>
              <h1 className="font-display" style={{
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                fontWeight: 300,
                letterSpacing: '-0.025em',
                lineHeight: 1.05,
                marginBottom: '0.75rem',
              }}>
                Performance ads.<br />On brand.
              </h1>
              <p style={{ color: 'var(--navy-40)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                Enter your copy, choose your channels, hit Generate.
                Preview every size, download a production-ready zip.
              </p>
            </div>
          )}

          {generated && (
            <p style={{
              color: 'var(--navy-40)', fontSize: '0.7rem', fontWeight: 500,
              letterSpacing: '0.10em', marginBottom: '1.5rem', textTransform: 'uppercase',
            }}>Edit</p>
          )}

          <div style={{ maxWidth: generated ? '100%' : '480px', margin: '0 auto' }}>
            <AdGeneratorForm
              text={text}
              onTextChange={setText}
              cta={cta}
              onCtaChange={setCta}
              onGenerate={handleGenerate}
              generating={generating}
            />
          </div>
        </aside>

        {/* Preview panel */}
        {generated && (
          <section id="preview-section" style={{ overflowY: 'auto', padding: '2.5rem' }}>
            <PreviewGrid
              specs={generated.specs}
              text={text}
              cta={cta}
              backgroundSrc={generated.backgroundSrc}
              projectName={generated.projectName}
              onRegenBackground={handleRegenBackground}
            />
          </section>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--navy-20)',
        color: 'var(--navy-40)',
        fontSize: '0.7rem',
        letterSpacing: '0.04em',
        padding: '1rem 2rem',
        textAlign: 'center',
      }}>
        Fin Ad Generator — internal tool
      </footer>
    </div>
  );
}
