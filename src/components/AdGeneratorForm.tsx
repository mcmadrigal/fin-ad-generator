'use client';

import { useState, useCallback } from 'react';
import type { AssetSetKey, FormState } from '@/types';
import { ASSET_SPECS, CHANNEL_LABELS, ALL_CHANNELS, getSpecsForSet } from '@/lib/assetSpecs';
import { countWords } from '@/lib/textLayout';

const SET_OPTIONS: Array<{ key: AssetSetKey; label: string }> = [
  { key: 'full',     label: 'Full Set' },
  { key: 'ttd',      label: 'TTD' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'sixsense', label: '6Sense' },
  { key: 'meta',     label: 'Meta' },
];

function initialSelectedKeys(setKey: AssetSetKey): Set<string> {
  return new Set(getSpecsForSet(setKey).map(s => s.key));
}

interface Props {
  onGenerate: (state: FormState) => void;
  generating: boolean;
}

export function AdGeneratorForm({ onGenerate, generating }: Props) {
  const [projectName, setProjectName] = useState('');
  const [text, setText]               = useState('');
  const [cta, setCta]                 = useState('');
  const [activeSet, setActiveSet]     = useState<AssetSetKey>('full');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(initialSelectedKeys('full'));

  const textWords = countWords(text);
  const ctaWords  = countWords(cta);
  const textError = textWords > 12;
  const ctaError  = ctaWords  > 4;

  // When the set changes, reset selectedKeys to all specs in that set
  const handleSetChange = useCallback((setKey: AssetSetKey) => {
    setActiveSet(setKey);
    setSelectedKeys(initialSelectedKeys(setKey));
  }, []);

  const toggleSize = useCallback((key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const canGenerate =
    projectName.trim().length > 0 &&
    text.trim().length > 0 &&
    cta.trim().length > 0 &&
    !textError &&
    !ctaError &&
    selectedKeys.size > 0 &&
    !generating;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canGenerate) return;
    onGenerate({ projectName, text, cta, activeSet, selectedKeys });
  };

  // Channels to display checkboxes for
  const channelsToShow = activeSet === 'full' ? ALL_CHANNELS : [activeSet as typeof ALL_CHANNELS[number]];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Project name ──────────────────────────────────────────────── */}
      <div>
        <label className="block mb-2" style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--navy-40)' }}>
          Project Name
        </label>
        <input
          className="fin-input"
          type="text"
          placeholder="e.g. FinROI"
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
          maxLength={60}
        />
        <p className="mt-1" style={{ fontSize: '0.7rem', color: 'var(--navy-40)' }}>
          Used in file naming only
        </p>
      </div>

      {/* ── Ad copy ───────────────────────────────────────────────────── */}
      <div>
        <label className="block mb-2" style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--navy-40)' }}>
          Ad Copy
          <span style={{ marginLeft: '0.5rem', color: textError ? 'var(--orange)' : 'var(--navy-40)' }}>
            {textWords}/12 words
          </span>
        </label>
        <textarea
          className={`fin-input${textError ? ' error' : ''}`}
          rows={3}
          placeholder="Resolve 51% of support queries with Fin."
          value={text}
          onChange={e => setText(e.target.value)}
          style={{ resize: 'vertical', minHeight: '72px' }}
        />
        {textError && (
          <p className="mt-1" style={{ fontSize: '0.7rem', color: 'var(--orange)' }}>
            Max 12 words
          </p>
        )}
      </div>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <div>
        <label className="block mb-2" style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--navy-40)' }}>
          CTA
          <span style={{ marginLeft: '0.5rem', color: ctaError ? 'var(--orange)' : 'var(--navy-40)' }}>
            {ctaWords}/4 words
          </span>
        </label>
        <input
          className={`fin-input${ctaError ? ' error' : ''}`}
          type="text"
          placeholder="See Fin in action"
          value={cta}
          onChange={e => setCta(e.target.value)}
          maxLength={60}
        />
        {ctaError && (
          <p className="mt-1" style={{ fontSize: '0.7rem', color: 'var(--orange)' }}>
            Max 4 words
          </p>
        )}
      </div>

      {/* ── Asset set selector ────────────────────────────────────────── */}
      <div>
        <label className="block mb-3" style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--navy-40)' }}>
          Asset Set
        </label>
        <div className="flex flex-wrap gap-2">
          {SET_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleSetChange(opt.key)}
              style={{
                background:   activeSet === opt.key ? 'var(--orange)' : 'transparent',
                border:       `1px solid ${activeSet === opt.key ? 'var(--orange)' : 'var(--navy-20)'}`,
                borderRadius: '3px',
                color:        activeSet === opt.key ? '#000' : 'var(--stark-white)',
                cursor:       'pointer',
                fontSize:     '0.75rem',
                fontWeight:   '500',
                letterSpacing:'0.06em',
                padding:      '0.375rem 0.875rem',
                textTransform:'uppercase',
                transition:   'all 150ms ease',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Individual size toggles ───────────────────────────────────── */}
      <div className="space-y-4">
        {channelsToShow.map(channel => (
          <div key={channel}>
            <p className="channel-label mb-2">{CHANNEL_LABELS[channel]}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {ASSET_SPECS[channel].map(spec => (
                <label
                  key={spec.key}
                  className="flex items-center gap-1.5 cursor-pointer"
                  style={{ fontSize: '0.75rem', color: selectedKeys.has(spec.key) ? 'var(--stark-white)' : 'var(--navy-40)' }}
                >
                  <input
                    type="checkbox"
                    className="fin-checkbox"
                    checked={selectedKeys.has(spec.key)}
                    onChange={() => toggleSize(spec.key)}
                  />
                  {spec.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Submit ────────────────────────────────────────────────────── */}
      <div className="pt-2">
        <button type="submit" className="btn-primary w-full" disabled={!canGenerate}>
          {generating ? 'Generating…' : 'Generate Ads'}
        </button>
        {selectedKeys.size === 0 && (
          <p className="mt-2 text-center" style={{ fontSize: '0.7rem', color: 'var(--orange)' }}>
            Select at least one size to continue
          </p>
        )}
      </div>
    </form>
  );
}
