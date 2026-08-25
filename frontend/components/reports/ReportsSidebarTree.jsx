import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import {
  REPORTS_SECTIONS,
  getDefaultReportPath,
  reportAppPath,
} from '../../constants/reportsMenu.js';
import reportsIcon from '../../assets/Reports new.png';
import SidebarSubmenuArrow from '../icons/SidebarSubmenuArrow.jsx';
import styles from './ReportsSidebarTree.module.css';

const SUBMENU_WIDTH = 300;
const VIEW_EDGE = 8;

/**
 * Nested report links stay in the DOM under the section row (no portal).
 * They use position:fixed only for placement so overflow:hidden on the sidebar
 * cannot clip them, while mouse hover still counts as inside the Reports tree.
 */
export default function ReportsSidebarTree({ isOpen }) {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [openSectionId, setOpenSectionId] = useState(null);
  const [submenuStyle, setSubmenuStyle] = useState(null);
  const rootRef = useRef(null);
  const sectionItemRefs = useRef({});
  const submenuRefs = useRef({});

  const firstHref = appPath(getDefaultReportPath());
  const branchActive = pathname.includes('/reports/');

  const closeAll = () => {
    setExpanded(false);
    setOpenSectionId(null);
    setSubmenuStyle(null);
  };

  useLayoutEffect(() => {
    if (!openSectionId) {
      setSubmenuStyle(null);
      return undefined;
    }

    const place = () => {
      const item = sectionItemRefs.current[openSectionId];
      const menu = submenuRefs.current[openSectionId];
      if (!item || !menu) return;

      const rect = item.getBoundingClientRect();
      const vh = window.innerHeight;
      const naturalHeight = menu.scrollHeight;
      const spaceBelow = Math.max(0, vh - rect.top - VIEW_EDGE);
      const spaceAbove = Math.max(0, rect.bottom - VIEW_EDGE);
      const openUp = spaceBelow < Math.min(naturalHeight, 200) && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        120,
        Math.min(naturalHeight, openUp ? spaceAbove : spaceBelow, vh - VIEW_EDGE * 2),
      );
      const top = openUp
        ? Math.max(VIEW_EDGE, rect.bottom - maxHeight)
        : Math.min(rect.top, vh - VIEW_EDGE - Math.min(maxHeight, 120));

      let left = Math.round(rect.right - 1);
      if (left + SUBMENU_WIDTH > window.innerWidth - VIEW_EDGE) {
        left = Math.max(VIEW_EDGE, Math.round(rect.left - SUBMENU_WIDTH + 1));
      }

      setSubmenuStyle({
        position: 'fixed',
        top: `${Math.round(top)}px`,
        left: `${left}px`,
        width: `${SUBMENU_WIDTH}px`,
        maxHeight: `${Math.round(maxHeight)}px`,
        zIndex: 1400,
      });
    };

    place();
    const raf = window.requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [openSectionId]);

  return (
    <li
      ref={rootRef}
      className={`treeview ${expanded ? 'open' : ''}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={closeAll}
    >
      <Link
        to={firstHref}
        className={`${expanded ? 'expanded' : ''} ${branchActive ? 'active' : ''}`.trim()}
        onClick={closeAll}
        aria-haspopup="true"
      >
        <img src={reportsIcon} alt="" className="icon" aria-hidden />
        {isOpen ? <span>Reports</span> : null}
        {isOpen ? <SidebarSubmenuArrow className="icon master-chevron" /> : null}
      </Link>

      <ul
        className={`treeview-menu ${styles.sectionMenu}`}
        data-anchored="true"
      >
        {REPORTS_SECTIONS.map((section) => {
          const sectionOpen = openSectionId === section.id;
          const sectionActive = pathname.includes(`/reports/${section.id}/`);
          return (
            <li
              key={section.id}
              ref={(node) => {
                sectionItemRefs.current[section.id] = node;
              }}
              className={styles.sectionItem}
              onMouseEnter={() => setOpenSectionId(section.id)}
            >
              <Link
                to={appPath(reportAppPath(section.id, section.items[0].id))}
                className={`${styles.sectionBtn} ${sectionActive || sectionOpen ? styles.sectionBtnActive : ''}`}
                onFocus={() => setOpenSectionId(section.id)}
                onClick={closeAll}
                aria-haspopup="true"
              >
                <SidebarSubmenuArrow />
                <span>{section.label}</span>
                <SidebarSubmenuArrow className={styles.sectionChevron} />
              </Link>

              {sectionOpen ? (
                <ul
                  ref={(node) => {
                    submenuRefs.current[section.id] = node;
                  }}
                  className={styles.reportMenu}
                  style={submenuStyle || { visibility: 'hidden' }}
                  role="menu"
                >
                  {section.items.map((item) => {
                    const href = reportAppPath(section.id, item.id);
                    const active = pathname === href || pathname.startsWith(`${href}/`);
                    return (
                      <li key={item.id}>
                        <Link
                          to={appPath(href)}
                          className={active ? `${styles.reportLink} active` : styles.reportLink}
                          onClick={closeAll}
                          role="menuitem"
                        >
                          <SidebarSubmenuArrow />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </li>
  );
}
