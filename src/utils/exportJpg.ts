import { toJpeg } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { safeFileName } from './id';

export async function waitFonts(): Promise<void> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
}

export async function nextPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function cardToJpeg(el: HTMLElement, quality = 0.92): Promise<string> {
  await waitFonts();
  const images = Array.from(el.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    }),
  );
  await nextPaint();
  return toJpeg(el, {
    quality,
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: '#ffffff',
  });
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function zipJpegs(
  files: { name: string; dataUrl: string }[],
  zipName: string,
) {
  const zip = new JSZip();
  for (const file of files) {
    const base64 = file.dataUrl.split(',')[1] || '';
    zip.file(`${safeFileName(file.name)}.jpg`, base64, { base64: true });
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, zipName);
}
