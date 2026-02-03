export async function processLargeFile(file, chunkSize = 1024 * 1024) {
    const chunks = [];
    let offset = 0;
    
    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize);
      const arrayBuffer = await chunk.arrayBuffer();
      chunks.push(new Uint8Array(arrayBuffer));
      offset += chunkSize;
    }
    
    // Combine chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let position = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, position);
      position += chunk.length;
    }
    
    return result.buffer;
  }
  
  export function isLargeFile(file, threshold = 10 * 1024 * 1024) {
    return file.size > threshold;
  }