/** Extrai um quadro do vídeo para usar como capa na grade, sem reenviar o arquivo. */
export async function createVideoPosters(
  file: File
): Promise<{ thumb: Blob; preview: Blob }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  video.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0';
  document.body.appendChild(video);

  try {
    await waitFor(video, 'loadeddata', 20000);
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error('Vídeo sem quadro legível');
    }

    const duration = video.duration;
    if (Number.isFinite(duration) && duration > 0.4) {
      video.currentTime = Math.min(1, duration * 0.1);
      await waitFor(video, 'seeked', 8000);
    }

    const [thumb, preview] = await Promise.all([
      frameBlob(video, 480, 0.72),
      frameBlob(video, 1600, 0.8),
    ]);
    return { thumb, preview };
  } finally {
    video.removeAttribute('src');
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  }
}

function frameBlob(video: HTMLVideoElement, maxEdge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas 2D indisponível'));
  ctx.drawImage(video, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Falha ao gerar capa do vídeo'))),
      'image/jpeg',
      quality
    );
  });
}

function waitFor(target: EventTarget, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Tempo esgotado aguardando ${event}`));
    }, timeoutMs);
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error('Falha ao ler o vídeo'));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      target.removeEventListener(event, onOk);
      target.removeEventListener('error', onErr);
    };
    target.addEventListener(event, onOk, { once: true });
    target.addEventListener('error', onErr, { once: true });
  });
}
