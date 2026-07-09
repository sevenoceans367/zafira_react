import multer from 'multer';
import { attachmentDir, mapUploadedFiles } from './ticketAttachments.js';

export const vesselUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, attachmentDir),
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safeName}`);
    },
  }),
}).array('attach_file', 10);

export const particularsUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, attachmentDir),
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safeName}`);
    },
  }),
}).any();

export function mergeVesselAttachments(existingFiles = [], existingNames = [], uploaded = []) {
  const keptFiles = existingFiles.filter(Boolean);
  const keptNames = existingNames.filter(Boolean);
  const { attachment, attachmentName } = mapUploadedFiles(uploaded);

  const files = [...keptFiles, ...(attachment ? attachment.split(',') : [])].filter(Boolean);
  const names = [...keptNames, ...(attachmentName ? attachmentName.split(',') : [])].filter(Boolean);

  return {
    attachment: files.join(','),
    attachmentName: names.join(','),
  };
}
