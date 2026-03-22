import { PDFDocument, rgb } from 'pdf-lib';

self.onmessage = async (e) => {
  const { action, payload } = e.data;
  
  try {
    let resultData;
    let transferables = [];
    
    // Helper to post progress safely
    const reportProgress = (value) => {
      self.postMessage({ type: 'progress', value });
    };

    if (action === 'merge') {
      const { files } = payload;
      const mergedPdf = await PDFDocument.create();
      
      for (let i = 0; i < files.length; i++) {
        reportProgress(Math.round((i / files.length) * 100));
        
        const srcDoc = await PDFDocument.load(files[i].buffer, { 
          ignoreEncryption: true 
        });
        
        let pageIndices = files[i].selectedPageIndices;
        if (!pageIndices || pageIndices.length === 0) {
          pageIndices = Array.from({ length: srcDoc.getPageCount() }, (_, i) => i);
        }
        
        const copiedPages = await mergedPdf.copyPages(srcDoc, pageIndices);
        copiedPages.forEach(page => mergedPdf.addPage(page));
      }
      
      reportProgress(90);
      resultData = await mergedPdf.save();
      transferables.push(resultData.buffer);
    } 
    else if (action === 'compress') {
      const { buffer, level } = payload;
      reportProgress(10);
      
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      reportProgress(50);
      
      // Basic pdf-lib compression via useObjectStreams and dropping metadata
      resultData = await doc.save({ 
        useObjectStreams: true,
        updateMetadata: false
      });
      
      reportProgress(90);
      transferables.push(resultData.buffer);
    }
    else if (action === 'sign') {
      const { buffer, signatures } = payload;
      reportProgress(10);
      const pdfDoc = await PDFDocument.load(buffer);
      reportProgress(30);
      
      const pages = pdfDoc.getPages();
      
      for (let i = 0; i < signatures.length; i++) {
        const sig = signatures[i];
        const page = pages[sig.pageIndex];
        if (!page) continue;
        
        const signatureImage = await pdfDoc.embedPng(sig.pngBytes);
        
        page.drawImage(signatureImage, {
          x: sig.x,
          y: sig.y,
          width: sig.width,
          height: sig.height,
          opacity: sig.opacity !== undefined ? sig.opacity : 1.0,
        });
        
        reportProgress(30 + Math.round(((i + 1) / signatures.length) * 40));
      }
      
      reportProgress(80);
      resultData = await pdfDoc.save();
      transferables.push(resultData.buffer);
      reportProgress(100);
    }
    else if (action === 'split') {
      const { buffer, ranges } = payload;
      reportProgress(10);
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      reportProgress(30);
      
      const splitResults = [];
      const totalRanges = ranges.length;
      
      for (let i = 0; i < totalRanges; i++) {
        const range = ranges[i];
        const newDoc = await PDFDocument.create();
        
        // pdf-lib pages are 0-indexed. Range is 1-indexed.
        const pageIndices = [];
        for (let p = range.from; p <= range.to; p++) {
          pageIndices.push(p - 1);
        }
        
        const copiedPages = await newDoc.copyPages(doc, pageIndices);
        copiedPages.forEach(page => newDoc.addPage(page));
        
        const savedBytes = await newDoc.save();
        splitResults.push({
          bytes: savedBytes.buffer,
          size: savedBytes.byteLength,
          from: range.from,
          to: range.to
        });
        transferables.push(savedBytes.buffer);
        
        reportProgress(30 + Math.round(((i + 1) / totalRanges) * 60));
      }
      
      resultData = splitResults;
      reportProgress(100);
    }
    else if (action === 'watermark') {
      const { buffer, wmType, wmText, fontSize, wmColor, opacity, imgScalePercent, textRotation, layoutPosition, targetPageIndices, imageBytes, imageMimeType } = payload;
      reportProgress(10);
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      reportProgress(30);
      
      const pages = doc.getPages();
      
      // Parse hex color (e.g., "#1a1a1a") into rgb for pdf-lib
      let r = 0, g = 0, b = 0;
      if (wmType === 'text' && wmColor) {
        const hex = wmColor.replace('#', '');
        r = parseInt(hex.substring(0, 2), 16) / 255;
        g = parseInt(hex.substring(2, 4), 16) / 255;
        b = parseInt(hex.substring(4, 6), 16) / 255;
      }
      
      let embeddedImage = null;
      if (wmType === 'image' && imageBytes) {
        if (imageMimeType === 'image/jpeg' || imageMimeType === 'image/jpg') {
          embeddedImage = await doc.embedJpg(imageBytes);
        } else {
          try {
            embeddedImage = await doc.embedPng(imageBytes);
          } catch (e) {
            // fallback attempt if mime type was missing but it's jpeg
            embeddedImage = await doc.embedJpg(imageBytes);
          }
        }
      }
      
      for (let i = 0; i < targetPageIndices.length; i++) {
        const pageIndex = targetPageIndices[i];
        const page = pages[pageIndex];
        if (!page) continue;
        
        const { width, height } = page.getSize();
        
        if (wmType === 'text') {
          // pdf-lib drawText rotates around the bottom-left of the text box
          // Text rotation logic needs proper positioning for "center" layout
          // We will just draw it in center for simplicity
          page.drawText(wmText, {
            x: width / 2 - (wmText.length * fontSize * 0.3), // basic centering approximation
            y: height / 2,
            size: fontSize,
            color: rgb(r, g, b),
            opacity: opacity,
            rotate: { type: 'degrees', angle: textRotation || 0 }
          });
        } else if (wmType === 'image' && embeddedImage) {
          const imgDims = embeddedImage.scale(1.0);
          const drawW = (width * imgScalePercent) / 100;
          const drawH = (imgDims.height / imgDims.width) * drawW;
          
          page.drawImage(embeddedImage, {
            x: (width - drawW) / 2,
            y: (height - drawH) / 2,
            width: drawW,
            height: drawH,
            opacity: opacity,
          });
        }
        
        reportProgress(30 + Math.round(((i + 1) / targetPageIndices.length) * 60));
      }
      
      resultData = await doc.save();
      transferables.push(resultData.buffer);
      reportProgress(100);
    }
    else {
      throw new Error(`Unknown action: ${action}`);
    }
    
    self.postMessage({
      type: 'result',
      data: resultData
    }, transferables);
    
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err.message
    });
  }
};