import type { AssetSpec, Channel, AssetSetKey } from '@/types';

function spec(
  channel: Channel,
  w: number,
  h: number,
  maxKB: number,
  formats: Array<'jpg' | 'png'> = ['jpg', 'png'],
): AssetSpec {
  return {
    width: w,
    height: h,
    channel,
    formats,
    maxFileSizeKB: maxKB,
    label: `${w}×${h}`,
    key: `${channel}-${w}x${h}`,
  };
}

export const ASSET_SPECS: Record<Channel, AssetSpec[]> = {
  ttd: [
    spec('ttd', 160,  600, 150),
    spec('ttd', 728,  90,  150),
    spec('ttd', 300,  600, 150),
    spec('ttd', 320,  50,  150),
    spec('ttd', 300,  50,  150),
    spec('ttd', 768,  1024, 150),
    spec('ttd', 1024, 768, 150),
    spec('ttd', 320,  480, 150),
    spec('ttd', 970,  250, 150),
    spec('ttd', 480,  320, 150),
  ],
  linkedin: [
    spec('linkedin', 1080, 1080, 5120),
    spec('linkedin', 1200, 1200, 5120),
  ],
  sixsense: [
    spec('sixsense', 1200, 628, 30720),
  ],
  meta: [
    spec('meta', 1080, 1080, 30720),
    spec('meta', 1080, 1920, 30720),
    spec('meta', 1920, 1080, 30720),
  ],
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  ttd:      'The Trade Desk',
  linkedin: 'LinkedIn',
  sixsense: '6Sense',
  meta:     'Meta',
};

export const CHANNEL_FILE_LABELS: Record<Channel, string> = {
  ttd:      'TTD',
  linkedin: 'LinkedIn',
  sixsense: '6Sense',
  meta:     'Meta',
};

export const ALL_CHANNELS: Channel[] = ['meta', 'linkedin', 'sixsense', 'ttd'];

export const SET_CHANNELS: Record<AssetSetKey, Channel[]> = {
  full:     ALL_CHANNELS,
  ttd:      ['ttd'],
  linkedin: ['linkedin'],
  sixsense: ['sixsense'],
  meta:     ['meta'],
};

export function getSpecsForSet(setKey: AssetSetKey): AssetSpec[] {
  return SET_CHANNELS[setKey].flatMap(ch => ASSET_SPECS[ch]);
}

export function getAllSpecs(): AssetSpec[] {
  return ALL_CHANNELS.flatMap(ch => ASSET_SPECS[ch]);
}
