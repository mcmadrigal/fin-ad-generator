'use client';

import { useState, useCallback } from 'react';
import type { FormState } from '@/types';
import type { AssetSpec } from '@/types';
import { getAllSpecs } from '@/lib/assetSpecs';
import { BG_IMAGES } from '@/lib/bgImages';
import { AdGeneratorForm } from '@/components/AdGeneratorForm';
import { PreviewGrid } from '@/components/PreviewGrid';

// GeneratedState holds everything that changes only on Generate click.
// Text, CTA, and backgroundSrc are tracked separately so previews update live.
interface GeneratedState {
  specs:       AssetSpec[];
  projectName: string;
}

export default function HomePage() {
  // Live copy state — drives preview immediately as the user types
  const [text,             setText]             = useState('Resolve 51% of support queries with Fin.');
  const [subheadline,      setSubheadline]      = useState('The #1 Agent in customer service');
  const [cta,              setCta]              = useState('See Fin in action');
  const [backgroundSrc,    setBackgroundSrc]    = useState(BG_IMAGES[0].src);
  const [showHeadline,     setShowHeadline]     = useState(true);
  const [showSubheadline,  setShowSubheadline]  = useState(true);
  const [showCta,          setShowCta]          = useState(true);

  const [generating, setGenerating] = useState(false);
  const [generated,  setGenerated]  = useState<GeneratedState>({
    specs:       getAllSpecs(),
    projectName: '',
  });

  const handleGenerate = useCallback(async (form: FormState) => {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 20)); // flush button state

    const allSpecs    = getAllSpecs();
    const activeSpecs = allSpecs.filter(s => form.selectedKeys.has(s.key));

    setGenerated({
      specs:       activeSpecs,
      projectName: form.projectName,
    });
    setGenerating(false);

    setTimeout(() => {
      document.getElementById('preview-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 120);
  }, []);

  const handleRegenBackground = useCallback(() => {
    setBackgroundSrc(prev => {
      const idx  = BG_IMAGES.findIndex(b => b.src === prev);
      const next = BG_IMAGES[(idx + 1) % BG_IMAGES.length];
      return next.src;
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
            src="/logos/fin_logo.svg"
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
        gridTemplateColumns: '360px 1fr',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0',
        width: '100%',
      }}>
        {/* Form panel */}
        <aside style={{
          borderRight: '1px solid var(--navy-20)',
          overflowY: 'auto',
          padding: '2.5rem 2rem',
          position: 'sticky',
          top: '0',
          alignSelf: 'start',
          maxHeight: '100vh',
        }}>
          <p style={{
            color: 'var(--navy-40)', fontSize: '0.7rem', fontWeight: 500,
            letterSpacing: '0.10em', marginBottom: '1.5rem', textTransform: 'uppercase',
          }}>Edit</p>

          <AdGeneratorForm
            text={text}
            onTextChange={setText}
            subheadline={subheadline}
            onSubheadlineChange={setSubheadline}
            cta={cta}
            onCtaChange={setCta}
            backgroundSrc={backgroundSrc}
            onBackgroundSrcChange={setBackgroundSrc}
            showHeadline={showHeadline}
            onShowHeadlineChange={setShowHeadline}
            showSubheadline={showSubheadline}
            onShowSubheadlineChange={setShowSubheadline}
            showCta={showCta}
            onShowCtaChange={setShowCta}
            onGenerate={handleGenerate}
            generating={generating}
          />
        </aside>

        {/* Preview panel */}
        <section id="preview-section" style={{ overflowY: 'auto', padding: '2.5rem' }}>
          <PreviewGrid
            specs={generated.specs}
            text={text}
            subheadline={subheadline}
            cta={cta}
            showHeadline={showHeadline}
            showSubheadline={showSubheadline}
            showCta={showCta}
            backgroundSrc={backgroundSrc}
            projectName={generated.projectName}
            onRegenBackground={handleRegenBackground}
          />
        </section>
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
