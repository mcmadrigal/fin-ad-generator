/**
 * Packages all rendered ads into a zip file and triggers a browser download.
 * All operations are client-side (JSZip).
 */

import type { AssetSpec } from '@/types';
import { CHANNEL_FILE_LABELS } from './assetSpecs';
import { renderAdToCanvas, exportWithSizeLimit } from './canvasRenderer';

export interface PackageJob {
  spec:            AssetSpec;
  text:            string;
  subheadline:     string;
  cta:             string;
  showSubheadline: boolean;
  showCta:         boolean;
  backgroundSrc:   string;
  projectName:     string;
}

/** Sanitise a string for use in file/folder names */
function sanitise(s: string): string {
  return s.trim().replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 40) || 'Fin';
}

/** YYYY-MM-DD in local time */
function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function buildAndDownloadZip(
  jobs: PackageJob[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  // Lazy import JSZip — keeps bundle split clean
  const { default: JSZip } = await import('jszip');

  if (jobs.length === 0) return;

  const today      = todayISO();
  const projectRaw = jobs[0].projectName;
  const project    = sanitise(projectRaw);
  const folderName = `${project}_Ads_${today}`;
  const zip        = new JSZip();
  const folder     = zip.folder(folderName)!;

  const total = jobs.length * 2; // jpg + png per spec
  let done    = 0;

  for (const job of jobs) {
    const { spec, text, subheadline, cta, showSubheadline, showCta, backgroundSrc } = job;
    const channel  = CHANNEL_FILE_LABELS[spec.channel];
    const size     = `${spec.width}x${spec.height}`;
    const baseName = `${project}_Display_${channel}-${size}_${today}`;
    const maxBytes = spec.maxFileSizeKB * 1024;

    // Render at full resolution
    const canvas = document.createElement('canvas');
    await renderAdToCanvas(canvas, spec.width, spec.height, text, subheadline, cta, showSubheadline, showCta, backgroundSrc);

    // JPEG
    const jpgBlob = await exportWithSizeLimit(canvas, 'jpg', maxBytes);
    folder.file(`${baseName}.jpg`, jpgBlob);
    onProgress?.(++done, total);

    // PNG
    const pngBlob = await exportWithSizeLimit(canvas, 'png', maxBytes);
    folder.file(`${baseName}.png`, pngBlob);
    onProgress?.(++done, total);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  triggerDownload(zipBlob, `${folderName}.zip`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
