/**
 * Format a byte count into a human-readable file-size string.
 * @param {number} bytes
 * @returns {string}  e.g. "1.4 KB", "3.20 MB"
 */
export default function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
