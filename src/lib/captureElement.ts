/** SVG foreignObject capture — pixel-perfect PNG export using the live browser renderer. */

// Module-level font cache: path → base64 data URL
const fontCache = new Map<string, string>();

async function fontToDataURL(path: string): Promise<string> {
  if (fontCache.has(path)) return fontCache.get(path)!;
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`Failed to fetch ${path}: ${resp.status}`);
  const blob = await resp.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  fontCache.set(path, dataUrl);
  return dataUrl;
}

// Build @font-face CSS with all three brand fonts embedded as base64
async function buildEmbedCSS(): Promise<string> {
  const [regular, semibold, mono] = await Promise.all([
    fontToDataURL('/fonts/Saans-Regular.ttf'),
    fontToDataURL('/fonts/Saans-SemiBold.ttf'),
    fontToDataURL('/fonts/SaansMono-Regular.ttf'),
  ]);
  return [
    `@font-face{font-family:'Saans';src:url('${regular}')format('truetype');font-weight:normal;font-display:block;}`,
    `@font-face{font-family:'Saans';src:url('${semibold}')format('truetype');font-weight:600;font-display:block;}`,
    `@font-face{font-family:'SaansMono';src:url('${mono}')format('truetype');font-weight:normal;font-display:block;}`,
    `*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}`,
    `.ad-inner{position:absolute;top:0;left:0;transform-origin:top left;}`,
  ].join('');
}

/**
 * Capture `el` at `w × h` pixels using SVG foreignObject rendering.
 * Returns a PNG Blob.
 */
export async function captureElement(el: HTMLElement, w: number, h: number): Promise<Blob> {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.transform       = 'none';
  clone.style.width           = `${w}px`;
  clone.style.height          = `${h}px`;
  clone.style.position        = 'absolute';
  clone.style.top             = '0';
  clone.style.left            = '0';
  clone.style.transformOrigin = 'top left';

  const embedCSS = await buildEmbedCSS();
  const html     = clone.outerHTML;

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
      reject(new Error('SVG image failed to load'));
    };
    img.src = svgUrl;
  });
}
