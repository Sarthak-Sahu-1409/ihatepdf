async function signPDF({ fileBuffer, signatureDataUrl, position }) {
    try {
      const pdfDoc = await PDFDocument.load(fileBuffer);
      
      // Convert base64 signature to PNG
      const signatureBytes = Uint8Array.from(
        atob(signatureDataUrl.split(',')[1]),
        c => c.charCodeAt(0)
      );
      
      const signatureImage = await pdfDoc.embedPng(signatureBytes);
      
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      const { width, height } = lastPage.getSize();
      
      // Position signature (default: bottom right)
      const signatureWidth = 150;
      const signatureHeight = 50;
      const x = position?.x || width - signatureWidth - 50;
      const y = position?.y || 50;
      
      lastPage.drawImage(signatureImage, {
        x,
        y,
        width: signatureWidth,
        height: signatureHeight,
      });
      
      self.postMessage({ type: 'PROGRESS', progress: 100 });
      
      const signedPdfBytes = await pdfDoc.save();
      
      self.postMessage({
        type: 'COMPLETE',
        result: signedPdfBytes
      });
    } catch (error) {
      self.postMessage({
        type: 'ERROR',
        error: error.message
      });
    }
  }