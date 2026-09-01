import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { USER_GUIDES } from '../../../constants/userGuides.js';
import { userGuidesBasePath } from '../../../constants/userGuidesModule.js';
import styles from './UserGuidesPages.module.css';

export default function UserGuidesPage() {
  const { module = 'vc' } = useParams();
  const basePath = userGuidesBasePath(module);

  return (
    <div className={`zafira-page ${styles.page}`}>
      <h3 className={styles.title}>Guides</h3>

      <div className={styles.guideList}>
        {USER_GUIDES.map((guide) => (
          <Link
            key={guide.id}
            to={`${basePath}/${guide.id}`}
            className={styles.guideLink}
          >
            <i className={`bi bi-book ${styles.guideIcon}`} aria-hidden />
            <span className={styles.guideTitle}>{guide.title}</span>
            <i className={`bi bi-chevron-right ${styles.guideChevron}`} aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}
