/** Gera JPEG leve para grades (admin/cliente), mantendo o original no Storage. */
export async function createImageThumbnail(
  file: File,
  maxEdge = 480,
  quality = 0.72
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponível');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Falha ao gerar miniatura'))),
        'image/jpeg',
        quality
      );
    });
    return blob;
  } finally {
    bitmap.close();
  }
}
