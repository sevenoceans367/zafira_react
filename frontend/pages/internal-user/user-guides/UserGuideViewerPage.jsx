import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@bainbridge/shared-ui';
import {
  getUserGuideAttachmentUrl,
  getUserGuideById,
} from '../../../constants/userGuides.js';
import { userGuidesBasePath } from '../../../constants/userGuidesModule.js';
import styles from './UserGuidesPages.module.css';

export default function UserGuideViewerPage() {
  const navigate = useNavigate();
  const { module = 'vc', guideId } = useParams();
  const listPath = userGuidesBasePath(module);
  const guide = getUserGuideById(guideId);

  useEffect(() => {
    const blockContextMenu = (event) => event.preventDefault();
    document.addEventListener('contextmenu', blockContextMenu);
    return () => document.removeEventListener('contextmenu', blockContextMenu);
  }, []);

  if (!guide) {
    return (
      <div className={`zafira-page ${styles.page}`}>
        <div className={styles.error}>User guide not found.</div>
        <div className={styles.viewerHeader}>
          <Button variant="secondary" label="Back" onClick={() => navigate(listPath)} />
        </div>
      </div>
    );
  }

  const pdfUrl = `${getUserGuideAttachmentUrl(guide.fileName)}#toolbar=0&navpanes=0`;

  return (
    <div className={`zafira-page ${styles.page}`}>
      <div className={styles.viewerHeader}>
        <Button variant="secondary" label="Back" onClick={() => navigate(listPath)} />
      </div>

      <h3 className={styles.title}>{guide.title}</h3>

      <div className={styles.viewerFrameWrap}>
        <iframe
          className={styles.viewerFrame}
          title={guide.title}
          src={pdfUrl}
        />
      </div>
    </div>
  );
}
