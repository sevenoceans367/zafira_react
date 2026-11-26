import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractLaytimeKeepFiles, buildLaytimeAttachmentPayload, buildExistingDropzoneItems } from './laytimeAttachmentHelpers.js';

describe('Laytime attachment helpers', () => {
  it('normalizes stored strings and objects without losing display names', () => {
    const state = extractLaytimeKeepFiles([{ file: '1700000_sof.pdf', name: 'Signed SOF.pdf' }, '1700001_nor.pdf']);
    assert.deepEqual(state.keepFiles, ['1700000_sof.pdf', '1700001_nor.pdf']);
    assert.deepEqual(state.keepFileNamesByFile, { '1700000_sof.pdf': 'Signed SOF.pdf', '1700001_nor.pdf': 'nor.pdf' });
    assert.deepEqual(buildLaytimeAttachmentPayload(state.keepFiles, state.keepFileNamesByFile), {
      keepFiles: state.keepFiles, keepFileNames: ['Signed SOF.pdf', 'nor.pdf'],
    });
    assert.deepEqual(buildExistingDropzoneItems(state.keepFiles, state.keepFileNamesByFile, (f) => `/attachment/${f}`)[0], {
      key: '1700000_sof.pdf', file: '1700000_sof.pdf', name: 'Signed SOF.pdf', url: '/attachment/1700000_sof.pdf',
    });
  });
});
