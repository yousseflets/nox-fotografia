/** Gera JPEG com marca d'agua "NOX Fotografia" para previa publica. */
export async function createWatermarkedPreview(
  file: File,
  maxEdge = 1600,
  quality = 0.82
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
    if (!ctx) throw new Error('Canvas 2D indisponivel');

    ctx.drawImage(bitmap, 0, 0, width, height);

    const label = 'NOX Fotografia';
    const fontSize = Math.max(22, Math.round(Math.min(width, height) * 0.045));
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.font = `700 ${fontSize}px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, fontSize * 0.08);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.fillStyle = 'rgba(212,175,55,0.55)';

    const textWidth = ctx.measureText(label).width;
    const stepX = Math.ceil(textWidth + fontSize * 2.4);
    const stepY = Math.ceil(fontSize * 5.2);
    const span = Math.hypot(width, height);
    for (let y = -span; y <= span; y += stepY) {
      for (let x = -span; x <= span; x += stepX) {
        const offset = (Math.round(y / stepY) % 2) * (stepX / 2);
        ctx.strokeText(label, x + offset, y);
        ctx.fillText(label, x + offset, y);
      }
    }
    ctx.restore();

    // faixa inferior
    const barH = Math.max(28, fontSize * 1.15);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, height - barH, width, barH);
    ctx.font = `600 ${Math.max(13, fontSize * 0.5)}px Georgia, 'Times New Roman', serif`;
    ctx.fillStyle = 'rgba(212,175,55,0.95)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, width - 14, height - barH / 2);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Falha ao gerar preview'))),
        'image/jpeg',
        quality
      );
    });
  } finally {
    bitmap.close();
  }
}
