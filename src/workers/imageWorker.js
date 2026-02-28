/* eslint-disable no-restricted-globals */
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

self.onmessage = async (e) => {
  const { type, data } = e.data;
  
  try {
    if (type === 'PDF_TO_JPG') {
      await pdfToJpg(data);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      error: error.message
    });
  }
};

async function pdfToJpg({ fileBuffer, quality = 0.92, scale = 2.0 }) {
  const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
  const images = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: quality
    });
    
    const arrayBuffer = await blob.arrayBuffer();
    
    images.push({
      bytes: arrayBuffer,
      name: `page_${i}.jpg`
    });
    
    const progress = Math.round((i / pdf.numPages) * 100);
    self.postMessage({ type: 'PROGRESS', progress });
  }
  
  self.postMessage({
    type: 'COMPLETE',
    result: images
  });
}