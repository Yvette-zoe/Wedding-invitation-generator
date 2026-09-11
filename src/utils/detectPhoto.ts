/** 从请柬底图里找出已有婚纱照的矩形，用来叠用户上传的新照片 */

export interface DetectedPhotoBox {
  x: number;
  y: number;
  w: number;
  h: number;
  imgW: number;
  imgH: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('底图读取失败'));
    img.src = src;
  });
}

function dist(a: number[], b: number[]) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export async function detectPhotoBox(src: string): Promise<DetectedPhotoBox | null> {
  const img = await loadImage(src);
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  if (imgW < 8 || imgH < 8) return null;

  const tw = 96;
  const th = Math.max(8, Math.round((imgH / imgW) * tw));
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, tw, th);
  const data = ctx.getImageData(0, 0, tw, th).data;

  const pixel = (x: number, y: number) => {
    const i = (y * tw + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };

  const inset = 4;
  const samples = [
    [inset, inset],
    [tw - inset, inset],
    [inset, th - inset],
    [tw - inset, th - inset],
    [Math.round(tw / 2), inset],
    [inset, Math.round(th / 2)],
  ].map(([x, y]) => pixel(x, y));
  const paper = samples
    .reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0])
    .map((v) => v / samples.length);

  const mask = new Uint8Array(tw * th);
  for (let y = 0; y < th; y += 1) {
    for (let x = 0; x < tw; x += 1) {
      const p = pixel(x, y);
      const max = Math.max(p[0], p[1], p[2], 1);
      const sat = (max - Math.min(p[0], p[1], p[2])) / max;
      if (dist(p, paper) > 36 || sat > 0.2) mask[y * tw + x] = 1;
    }
  }

  const seen = new Uint8Array(tw * th);
  let best: { x0: number; y0: number; x1: number; y1: number; count: number } | null = null;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let y = 0; y < th; y += 1) {
    for (let x = 0; x < tw; x += 1) {
      const start = y * tw + x;
      if (!mask[start] || seen[start]) continue;
      const stack = [[x, y]];
      seen[start] = 1;
      let x0 = x;
      let y0 = y;
      let x1 = x;
      let y1 = y;
      let count = 0;
      while (stack.length) {
        const [cx, cy] = stack.pop() as [number, number];
        count += 1;
        x0 = Math.min(x0, cx);
        y0 = Math.min(y0, cy);
        x1 = Math.max(x1, cx);
        y1 = Math.max(y1, cy);
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= tw || ny >= th) continue;
          const nidx = ny * tw + nx;
          if (mask[nidx] && !seen[nidx]) {
            seen[nidx] = 1;
            stack.push([nx, ny]);
          }
        }
      }
      if (!best || count > best.count) best = { x0, y0, x1, y1, count };
    }
  }

  if (!best || best.count < tw * th * 0.04) return null;
  const area = (best.x1 - best.x0 + 1) * (best.y1 - best.y0 + 1);
  if (area > tw * th * 0.82) return null;

  const pad = 1;
  const x = (Math.max(0, best.x0 - pad) / tw) * imgW;
  const y = (Math.max(0, best.y0 - pad) / th) * imgH;
  const w = Math.min(imgW - x, ((best.x1 - best.x0 + 1 + pad * 2) / tw) * imgW);
  const h = Math.min(imgH - y, ((best.y1 - best.y0 + 1 + pad * 2) / th) * imgH);
  if (w < imgW * 0.18 || h < imgH * 0.14) return null;
  return { x, y, w, h, imgW, imgH };
}
