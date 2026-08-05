import { isDbConfigured } from '../config.js';
import {
  dbCreateOpsDocument,
  dbDeleteOpsDocument,
  dbGetOpsDocuments,
} from './opsDocumentsDb.js';

const MOCK = {
  comId: '1001',
  fcaId: '2001',
  nomId: '26-001',
  vesselName: 'ATLANTIC STAR',
  documents: [
    {
      id: '1',
      fileName: 'Charter Party',
      storedFiles: 'mock_cp.pdf',
      attachments: [
        { file: 'mock_cp.pdf', name: 'cp.pdf', url: '/attachment/mock_cp.pdf' },
      ],
    },
  ],
  vesselAttachments: [
    { file: 'mock_vessel.pdf', name: 'vessel.pdf', url: '/attachment/mock_vessel.pdf' },
  ],
  invoiceAttachments: [],
};

let mockDocs = structuredClone(MOCK);
let mockNextId = 2;

export async function getOpsDocuments(comId) {
  if (isDbConfigured()) return dbGetOpsDocuments(comId);
  return {
    ...mockDocs,
    comId: String(comId || mockDocs.comId),
  };
}

export async function createOpsDocument(comId, payload = {}, files = {}) {
  if (isDbConfigured()) {
    return dbCreateOpsDocument(comId, {
      fileName: payload.fileName || payload.txtFile || '',
      attachment: files.attachment || '',
      attachmentName: files.attachmentName || '',
    });
  }

  const id = String(mockNextId++);
  const stored = files.attachment || `mock_${id}.pdf`;
  const names = files.attachmentName || stored;
  mockDocs.documents.push({
    id,
    fileName: payload.fileName || 'Document',
    storedFiles: stored,
    attachments: String(stored).split(',').map((file, index) => ({
      file: file.trim(),
      name: String(names).split(',')[index]?.trim() || file.trim(),
      url: `/attachment/${encodeURIComponent(file.trim())}`,
    })),
  });
  return { msg: 0, id };
}

export async function deleteOpsDocument(comId, storedFiles) {
  if (isDbConfigured()) return dbDeleteOpsDocument(comId, storedFiles);
  const before = mockDocs.documents.length;
  mockDocs.documents = mockDocs.documents.filter(
    (row) => String(row.storedFiles) !== String(storedFiles),
  );
  if (mockDocs.documents.length === before) {
    const error = new Error('Document not found.');
    error.status = 404;
    throw error;
  }
  return { msg: 6 };
}

export function __resetOpsDocumentsMockForTests() {
  mockDocs = structuredClone(MOCK);
  mockNextId = 2;
}
