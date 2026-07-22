import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { appPath } from '@bainbridge/shared-routing';
import {
  REPORTS_SECTIONS,
  reportAppPath,
} from '../../constants/reportsMenu.js';
import styles from './ReportsSidebarTree.module.css';

const SUBMENU_WIDTH = 300;
const SUBMENU_GAP = 4;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function ReportsSidebarTree({ isOpen }) {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [openSectionId, setOpenSectionId] = useState(null);
  const [submenuPos, setSubmenuPos] = useState({ top: 0, left: 0, maxHeight: 420 });
  const rootRef = useRef(null);
  const sectionBtnRefs = useRef({});

  const openSection = REPORTS_SECTIONS.find((s) => s.id === openSectionId) || null;

  useLayoutEffect(() => {
    if (!openSectionId) return undefined;

    const updatePosition = () => {
      const btn = sectionBtnRefs.current[openSectionId];
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const maxHeight = Math.min(520, window.innerHeight - 24);
      const top = clamp(rect.top, 12, window.innerHeight - Math.min(maxHeight, 200) - 12);
      let left = rect.right + SUBMENU_GAP;
      if (left + SUBMENU_WIDTH > window.innerWidth - 12) {
        left = Math.max(12, rect.left - SUBMENU_WIDTH - SUBMENU_GAP);
      }
      setSubmenuPos({ top, left, maxHeight });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [openSectionId, expanded]);

  useEffect(() => {
    if (!expanded) {
      setOpenSectionId(null);
      return undefined;
    }

    const handlePointerDown = (event) => {
      const inRoot = rootRef.current?.contains(event.target);
      const inSubmenu = event.target.closest?.('[data-reports-submenu]');
      if (!inRoot && !inSubmenu) {
        setExpanded(false);
        setOpenSectionId(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenSectionId(null);
        setExpanded(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [expanded]);

  return (
    <li
      ref={rootRef}
      className={`treeview ${expanded ? 'open' : ''}`}
      onMouseEnter={() => setExpanded(true)}
    >
      <button
        type="button"
        className={expanded ? 'expanded' : ''}
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-haspopup="true"
      >
        <i className="bi bi-file-earmark-bar-graph icon" aria-hidden />
        {isOpen ? <span>Reports</span> : null}
        {isOpen ? (
          <i className="bi bi-chevron-down master-chevron" aria-hidden />
        ) : null}
      </button>

      <ul className={`treeview-menu ${styles.sectionMenu}`}>
        {REPORTS_SECTIONS.map((section) => {
          const sectionOpen = openSectionId === section.id;
          const sectionActive = pathname.includes(`/reports/${section.id}/`);
          return (
            <li key={section.id} className={styles.sectionItem}>
              <button
                type="button"
                ref={(node) => {
                  sectionBtnRefs.current[section.id] = node;
                }}
                className={`${styles.sectionBtn} ${sectionActive || sectionOpen ? styles.sectionBtnActive : ''}`}
                onMouseEnter={() => setOpenSectionId(section.id)}
                onFocus={() => setOpenSectionId(section.id)}
                onClick={() => setOpenSectionId(section.id)}
                aria-expanded={sectionOpen}
                aria-haspopup="true"
              >
                <i className="bi bi-chevron-double-right icon" aria-hidden />
                <span>{section.label}</span>
                <i className={`bi bi-chevron-right ${styles.sectionChevron}`} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      {openSection
        ? createPortal(
          <ul
            data-reports-submenu
            className={styles.reportMenu}
            style={{
              top: submenuPos.top,
              left: submenuPos.left,
              maxHeight: submenuPos.maxHeight,
              width: SUBMENU_WIDTH,
            }}
          >
            {openSection.items.map((item) => {
              const href = reportAppPath(openSection.id, item.id);
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={item.id}>
                  <Link
                    to={appPath(href)}
                    className={active ? `${styles.reportLink} active` : styles.reportLink}
                    onClick={() => {
                      setExpanded(false);
                      setOpenSectionId(null);
                    }}
                  >
                    <i className="bi bi-chevron-double-right icon" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
        : null}
    </li>
  );
}
