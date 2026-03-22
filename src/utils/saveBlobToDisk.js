/**
 * Result when the browser handles saving (anchor / download manager): we cannot know if the user saved or cancelled.
 * The UI must not show a false "Downloaded!" state for this path.
 */
export const SAVE_RESULT_BROWSER = 'browser';

// Input: filename string. Output: File System Access API `types` array.
// Chooses PDF or generic accept entries from the file extension.
function pickerTypesForFilename(filename) {
  const lower = (filename || 'download').toLowerCase();
  if (lower.endsWith('.pdf')) {
    return [
      {
        description: 'PDF',
        accept: { 'application/pdf': ['.pdf'] },
      },
    ];
  }
  return [
    {
      description: 'File',
      accept: { '*/*': [] },
    },
  ];
}

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

// Input: blob (Blob), filename (string). Output: Promise true | false | SAVE_RESULT_BROWSER.
// Save picker when supported (true = saved, false = user dismissed); otherwise anchor download returns SAVE_RESULT_BROWSER.
export async function saveBlobToDisk(blob, filename) {
  const name = filename || 'download.pdf';

  if (typeof window !== 'undefined' && window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: pickerTypesForFilename(name),
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') return false;
      console.warn('saveBlobToDisk: picker failed, falling back to anchor', err);
    }
  }

  saveBlobViaAnchor(blob, name);
  return SAVE_RESULT_BROWSER;
}
