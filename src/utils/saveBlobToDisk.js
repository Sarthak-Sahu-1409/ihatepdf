/**
 * Result when the browser handles saving (anchor / download manager): we cannot know if the user saved or cancelled.
 * The UI must not show a false "Downloaded!" state for this path.
 */
export const SAVE_RESULT_BROWSER = 'browser';

// Input: blob (Blob), filename (string). Output: void.
// Programmatically clicks a temporary anchor; the OS/browser dialog outcome is not exposed to JS.
export function saveBlobViaAnchor(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

// Input: blob (Blob), filename (string). Output: SAVE_RESULT_BROWSER.
// Triggers an immediate browser anchor download. Returns SAVE_RESULT_BROWSER so callers can show confirmation UI.
export function saveBlobToDisk(blob, filename) {
  saveBlobViaAnchor(blob, filename || 'download.pdf');
  return SAVE_RESULT_BROWSER;
}
