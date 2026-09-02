import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import {
  createOpsTcDocument,
  deleteOpsTcDocument,
  fetchOpsTcDocuments,
} from '../../../services/opsTc.js';
import OpsTcBackHeaderActions from './OpsTcBackHeaderActions.jsx';
import OpsDocumentsPageContent from './OpsDocumentsPageContent.jsx';

const BACK_PATHS = {
  1: '/internal-user/vc/ops-tc/in-ops-glance',
  2: '/internal-user/vc/ops-tc/in-ops-glance?tab=post-ops',
  3: '/internal-user/vc/ops-tc/in-ops-glance?tab=history',
};

export default function OpsTcDocumentsPage() {
  const [searchParams] = useSearchParams();
  const comId = searchParams.get('comid') || searchParams.get('comId') || '';
  const page = searchParams.get('page') || '1';

  const backHref = useMemo(() => {
    const path = BACK_PATHS[Number(page)] || BACK_PATHS[1];
    return appPath(path);
  }, [page]);

  return (
    <>
      <OpsTcBackHeaderActions backHref={backHref} />
      <OpsDocumentsPageContent
        comId={comId}
        fetchDocuments={fetchOpsTcDocuments}
        createDocument={createOpsTcDocument}
        deleteDocument={deleteOpsTcDocument}
      />
    </>
  );
}
