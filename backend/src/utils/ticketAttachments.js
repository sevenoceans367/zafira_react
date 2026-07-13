import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const attachmentDir = path.join(__dirname, '../../attachment');

fs.mkdirSync(attachmentDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, attachmentDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  },
});

export const ticketUpload = multer({ storage }).array('mul_file', 10);
export const estimateUpload = multer({ storage }).array('attach_file', 10);

export function mapUploadedFiles(files = []) {
  const stored = [];
  const names = [];
  for (const file of files) {
    stored.push(file.filename);
    names.push(file.originalname);
  }
  return {
    attachment: stored.join(','),
    attachmentName: names.join(','),
  };
}
