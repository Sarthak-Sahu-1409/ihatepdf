/* ════════════════════════════════════════════════════════════════
   Image Worker — handles JPG→PDF & PDF→JPG off the main thread
   
   Uses OffscreenCanvas for rendering, createImageBitmap for decoding,
   and @jsquash/jpeg (MozJPEG WASM) for JPEG encoding.
   ════════════════════════════════════════════════════════════════ */

// @jsquash/jpeg is lazy-loaded — its WASM init accesses `document` which doesn't exist in workers
let _jsquashJpeg = null;
async function getWasmJpegEncode() {
  if (!_jsquashJpeg) {
    _jsquashJpeg = await import('@jsquash/jpeg');
  }
  return _jsquashJpeg.encode;
}

let pdfjsLib = null;
let pdfLib = null;

async function getPdfLib() {
  if (!pdfLib) pdfLib = await import('pdf-lib');
  return pdfLib;
}

async function getPdfjsLib() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    // Resolve inside the function to avoid any top-level DOM access in dev mode
    const pdfjsWorkerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  }
  return pdfjsLib;
}

// ── PDF to JPG ────────────────────────────────────────────────

async function pdfToJpg({ buffer, quality, startPage, endPage, outputScale }) {
  const pdfjs = await getPdfjsLib();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0, isEvalSupported: false }).promise;

  const total = endPage - startPage + 1;
  const outputs = [];

  for (let i = startPage; i <= endPage; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: outputScale });

    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Get raw pixel data for WASM encoder
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const qualityInt = Math.round(quality * 100);
    const wasmJpegEncode = await getWasmJpegEncode();
    const jpegBuffer = await wasmJpegEncode(imageData, {
      quality: Math.min(qualityInt, 100),
    });

    // Also generate a small thumbnail for UI preview
    const thumbScale = 0.25;
    const thumbW = Math.round(viewport.width * thumbScale);
    const thumbH = Math.round(viewport.height * thumbScale);
    const thumbCanvas = new OffscreenCanvas(thumbW, thumbH);
    const thumbCtx = thumbCanvas.getContext('2d');
    // Draw the full canvas scaled down to thumbnail
    thumbCtx.drawImage(canvas, 0, 0, thumbW, thumbH);
    const thumbData = thumbCtx.getImageData(0, 0, thumbW, thumbH);
    const thumbJpeg = await wasmJpegEncode(thumbData, { quality: 60 });

    outputs.push({
      pageNum: i,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      jpegBuffer,    // full quality JPEG
      thumbBuffer: thumbJpeg, // small preview
    });

    self.postMessage({
      type: 'progress',
      value: Math.round(((i - startPage + 1) / total) * 100),
      currentPage: i - startPage + 1,
    });
  }

  // Transfer all buffers to main thread
  const transferables = [];
  outputs.forEach((o) => {
    transferables.push(o.jpegBuffer);
    transferables.push(o.thumbBuffer);
  });

  self.postMessage(
    { type: 'result', data: outputs },
    transferables
  );
}

// ── JPG to PDF ────────────────────────────────────────────────

async function jpgToPdf({ images }) {
  const { PDFDocument, rgb } = await getPdfLib();
  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < images.length; i++) {
    const { buffer, fileName, mimeType } = images[i];

    const isJpeg = mimeType === 'image/jpeg' || /\.(jpe?g)$/i.test(fileName);
    const isPng = mimeType === 'image/png' || fileName.toLowerCase().endsWith('.png');
    const needsConvert = !isJpeg && !isPng;

    let embeddedImage;
    let imgW, imgH;

    if (needsConvert) {
      // Decode image using createImageBitmap (works in workers)
      const blob = new Blob([buffer], { type: mimeType || 'image/webp' });
      const bitmap = await createImageBitmap(blob);
      imgW = bitmap.width;
      imgH = bitmap.height;

      // Draw to OffscreenCanvas and re-encode as JPEG via WASM
      const canvas = new OffscreenCanvas(imgW, imgH);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      const imageData = ctx.getImageData(0, 0, imgW, imgH);
      const wasmJpegEncode = await getWasmJpegEncode();
      const jpegBuffer = await wasmJpegEncode(imageData, { quality: 95 });
      embeddedImage = await pdfDoc.embedJpg(new Uint8Array(jpegBuffer));
    } else {
      const uint8 = new Uint8Array(buffer);
      embeddedImage = isJpeg
        ? await pdfDoc.embedJpg(uint8)
        : await pdfDoc.embedPng(uint8);
      imgW = embeddedImage.width;
      imgH = embeddedImage.height;
    }

    const page = pdfDoc.addPage([imgW, imgH]);
    page.drawRectangle({ x: 0, y: 0, width: imgW, height: imgH, color: rgb(1, 1, 1) });
    page.drawImage(embeddedImage, { x: 0, y: 0, width: imgW, height: imgH });

    self.postMessage({
      type: 'progress',
      value: Math.round(((i + 1) / images.length) * 92),
      currentImg: i + 1,
    });
  }

  const bytes = await pdfDoc.save();
  self.postMessage({ type: 'progress', value: 100 });
  self.postMessage(
    { type: 'result', data: bytes.buffer },
    [bytes.buffer]
  );
}

// ── MESSAGE HANDLER ───────────────────────────────────────────

self.onmessage = async (e) => {
  const { action, payload } = e.data;

  try {
    switch (action) {
      case 'pdfToJpg':
        await pdfToJpg(payload);
        break;
      case 'jpgToPdf':
        await jpgToPdf(payload);
        break;
      default:
        self.postMessage({ type: 'error', message: `Unknown action: ${action}` });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || 'Worker error' });
  }
};
