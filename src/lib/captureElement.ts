/** SVG foreignObject capture — pixel-perfect PNG export using the live browser renderer. */

// Module-level cache: path → base64 data URL
const dataUrlCache = new Map<string, string>();

async function toDataURL(path: string): Promise<string> {
  if (dataUrlCache.has(path)) return dataUrlCache.get(path)!;
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`Failed to fetch ${path}: ${resp.status}`);
  const blob = await resp.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  dataUrlCache.set(path, dataUrl);
  return dataUrl;
}

// Build @font-face CSS with all three brand fonts embedded as base64
async function buildEmbedCSS(): Promise<string> {
  const [regular, semibold, mono] = await Promise.all([
    toDataURL('/fonts/Saans-Regular.ttf'),
    toDataURL('/fonts/Saans-SemiBold.ttf'),
    toDataURL('/fonts/SaansMono-Regular.ttf'),
  ]);
  return [
    `@font-face{font-family:'Saans';src:url('${regular}')format('truetype');font-weight:normal;font-display:block;}`,
    `@font-face{font-family:'Saans';src:url('${semibold}')format('truetype');font-weight:600;font-display:block;}`,
    `@font-face{font-family:'SaansMono';src:url('${mono}')format('truetype');font-weight:normal;font-display:block;}`,
    `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}`,
    `.ad-inner{position:absolute;top:0;left:0;transform-origin:top left;}`,
  ].join('');
}

// Replace url('/...') references inside an HTML string with embedded data URLs
async function inlineImages(html: string): Promise<string> {
  const paths = [...new Set(
    [...html.matchAll(/url\(['"]?(\/[^'")]+)['"]?\)/g)].map(m => m[1]),
  )];

  await Promise.allSettled(paths.map(p => toDataURL(p)));

  return html.replace(/url\(['"]?(\/[^'")]+)['"]?\)/g, (match, path) => {
    const d = dataUrlCache.get(path);
    return d ? `url('${d}')` : match;
  });
}

/**
 * Capture `el` at `w × h` pixels using SVG foreignObject rendering.
 * Returns a PNG Blob.
 */
export async function captureElement(el: HTMLElement, w: number, h: number): Promise<Blob> {
  // Clone so we can mutate styles without affecting the live DOM
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.transform       = 'none';
  clone.style.width           = `${w}px`;
  clone.style.height          = `${h}px`;
  clone.style.position        = 'absolute';
  clone.style.top             = '0';
  clone.style.left            = '0';
  clone.style.transformOrigin = 'top left';

  const embedCSS = await buildEmbedCSS();
  let   html     = clone.outerHTML;
  html           = await inlineImages(html);

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`,
    `<foreignObject width="${w}" height="${h}">`,
    `<html xmlns="http://www.w3.org/1999/xhtml">`,
    `<head><style>${embedCSS}</style></head>`,
    `<body style="margin:0;padding:0;overflow:hidden;">${html}</body>`,
    `</html>`,
    `</foreignObject>`,
    `</svg>`,
  ].join('');

  const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
  const svgUrl  = URL.createObjectURL(svgBlob);

  return new Promise<Blob>((resolve, reject) => {
    const img = new Image(w, h);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(svgUrl);
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))),
        'image/png',
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error('SVG Image failed to load'));
    };
    img.src = svgUrl;
  });
}
