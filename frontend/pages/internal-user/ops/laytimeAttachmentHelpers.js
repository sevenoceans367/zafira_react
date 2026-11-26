export function displayStoredFileName(stored) {
  const raw = String(stored || '').trim();
  const match = raw.match(/^\d+_(.+)$/);
  return match ? match[1] : raw;
}

export function extractLaytimeKeepFiles(uploads = []) {
  const keepFiles = [];
  const keepFileNamesByFile = {};
  for (const entry of uploads || []) {
    const file = entry && typeof entry === 'object' ? String(entry.file || '').trim() : String(entry || '').trim();
    if (!file) continue;
    keepFiles.push(file);
    keepFileNamesByFile[file] = (entry && typeof entry === 'object' ? String(entry.name || '').trim() : '') || displayStoredFileName(file);
  }
  return { keepFiles, keepFileNamesByFile };
}

export function buildExistingDropzoneItems(keepFiles = [], keepFileNamesByFile = {}, urlForFile = (file) => file) {
  return extractLaytimeKeepFiles(keepFiles).keepFiles.map((file) => ({
    key: file, file, name: keepFileNamesByFile?.[file] || displayStoredFileName(file), url: urlForFile(file),
  }));
}

export function buildLaytimeAttachmentPayload(keepFiles = [], keepFileNamesByFile = {}) {
  const files = extractLaytimeKeepFiles(keepFiles).keepFiles;
  return { keepFiles: files, keepFileNames: files.map((file) => keepFileNamesByFile?.[file] || displayStoredFileName(file)) };
}
