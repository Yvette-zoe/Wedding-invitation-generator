/** 压缩相册原图，避免请柬预览和本地草稿被大图撑爆 */
export async function compressImage(
  file: File,
  options: { maxEdge?: number; quality?: number; maxBytes?: number } = {},
): Promise<string> {
  // 默认给婚纱照用：自定义模板的照片区常占大半页，720px 原图放大后会糊，提高上限
  const maxEdge = options.maxEdge ?? 1280;
  let quality = options.quality ?? 0.82;
  const maxBytes = options.maxBytes ?? 900_000;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('无法读取该图片，请改用 JPG 或 PNG');
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('当前浏览器无法处理图片');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > maxBytes * 1.37 && quality > 0.42) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}

export function readImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('图片读取失败'));
    img.src = src;
  });
}

export function friendlyStorageError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/quota|exceeded/i.test(raw)) {
    return '图片太大，手机存不下。已改为压缩保存，请再点一次上传。';
  }
  if (/JSON|double-quoted property|Unexpected token|Unexpected end/i.test(raw)) {
    return '视觉模型返回的排版数据无法解析，请再点一次「视觉解析并上传」';
  }
  return raw || '操作失败';
}
