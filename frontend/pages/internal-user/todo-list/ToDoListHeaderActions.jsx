import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CardSelect, HeaderFilterControls, PageHeaderSearch } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';
import styles from './ToDoListHeaderActions.module.css';

const DESK_OPTIONS = [
  { id: '', name: 'All Desks' },
  { id: 'Singapore', name: 'Singapore' },
  { id: 'Dubai', name: 'Dubai' },
];

const TYPE_OPTIONS = [
  { id: '', name: 'All Transactions' },
  { id: 'receivable', name: 'Receivable' },
  { id: 'payable', name: 'Payable' },
];

const TYPE_COLORS = {
  '': '#8a93a0',
  receivable: '#14919b',
  payable: '#f4652c',
};

const BUSINESS_TYPE_OPTIONS = [
  { id: 'all', name: 'All' },
  { id: 'Dry Cargo', name: 'Dry Cargo' },
  { id: 'Tanker', name: 'Tanker' },
];

const VOYAGE_TYPE_OPTIONS = [
  { id: 'all', name: 'All' },
  { id: 'TC', name: 'TC' },
  { id: 'Voy', name: 'Voy' },
  { id: 'Other', name: 'Other' },
];

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11.1437 17.8828H4.67114" />
      <path fillRule="evenodd" clipRule="evenodd" d="M15.205 17.8837C15.205 19.9254 15.8859 20.6054 17.9267 20.6054C19.9676 20.6054 20.6485 19.9254 20.6485 17.8837C20.6485 15.8419 19.9676 15.1619 17.9267 15.1619C15.8859 15.1619 15.205 15.8419 15.205 17.8837Z" />
      <path d="M14.1765 7.39415H20.6481" />
      <path fillRule="evenodd" clipRule="evenodd" d="M10.1153 7.39281C10.1153 5.35192 9.43436 4.67102 7.39346 4.67102C5.35167 4.67102 4.67078 5.35192 4.67078 7.39281C4.67078 9.4346 5.35167 10.1146 7.39346 10.1146C9.43436 10.1146 10.1153 9.4346 10.1153 7.39281Z" />
    </svg>
  );
}

export default function ToDoListHeaderActions({
  search,
  onSearchChange,
  searchPlaceholder = 'Search all',
  accountType,
  onAccountTypeChange,
  moneyType,
  onMoneyTypeChange,
  filterDraft,
  onFilterDraftChange,
  onFilterApply,
  onFilterClear,
  filterActive = false,
  vesselOptions = [],
  onRun,
  runFlash = false,
}) {
  const searchRef = useRef(null);
  const filterBtnRef = useRef(null);
  const panelRef = useRef(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || event.target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!filterOpen) {
      setPanelStyle(null);
      return undefined;
    }
    const update = () => {
      const rect = filterBtnRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 300;
      setPanelStyle({
        position: 'fixed',
        top: rect.bottom + 8,
        left: Math.min(rect.right - width, window.innerWidth - width - 8),
        zIndex: 10050,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [filterOpen]);

  useEffect(() => {
    if (!filterOpen) return undefined;
    const handleClick = (event) => {
      if (filterBtnRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) {
        return;
      }
      setFilterOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [filterOpen]);

  return (
    <PageHeaderActions
      deps={[
        search,
        onSearchChange,
        searchPlaceholder,
        accountType,
        onAccountTypeChange,
        moneyType,
        onMoneyTypeChange,
        filterDraft?.businessType,
        filterDraft?.voyageType,
        filterDraft?.vessel,
        onFilterDraftChange,
        onFilterApply,
        onFilterClear,
        filterActive,
        vesselOptions,
        onRun,
        runFlash,
        filterOpen,
      ]}
    >
      <HeaderFilterControls>
        <PageHeaderSearch
          ref={searchRef}
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
        <CardSelect
          options={DESK_OPTIONS}
          value={accountType}
          onChange={onAccountTypeChange}
          placeholder="Desk"
          ariaLabel="Desk"
        />
        <div className={styles.typeWrap}>
          <span className={styles.typeDot} style={{ background: TYPE_COLORS[moneyType] || TYPE_COLORS[''] }} />
          <CardSelect
            options={TYPE_OPTIONS}
            value={moneyType}
            onChange={onMoneyTypeChange}
            placeholder="Type"
            ariaLabel="Type"
          />
        </div>
        <div className={styles.filterWrap}>
          <button
            ref={filterBtnRef}
            className={`${styles.filterBtn} ${filterActive ? styles.filterBtnOn : ''}`}
            type="button"
            onClick={() => setFilterOpen((open) => !open)}
          >
            <FilterIcon />
            Filter
          </button>
          {filterOpen && panelStyle
            ? createPortal(
              <div ref={panelRef} className={styles.filterPanel} style={panelStyle}>
                <div className={styles.fpField}>
                  <label htmlFor="ft-business-type">Business Type</label>
                  <select
                    id="ft-business-type"
                    value={filterDraft.businessType}
                    onChange={(event) => onFilterDraftChange({ ...filterDraft, businessType: event.target.value })}
                  >
                    {BUSINESS_TYPE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.fpField}>
                  <label htmlFor="ft-voyage-type">Voyage Type</label>
                  <select
                    id="ft-voyage-type"
                    value={filterDraft.voyageType}
                    onChange={(event) => onFilterDraftChange({ ...filterDraft, voyageType: event.target.value })}
                  >
                    {VOYAGE_TYPE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.fpField}>
                  <label htmlFor="ft-vessel">Vessel</label>
                  <select
                    id="ft-vessel"
                    value={filterDraft.vessel}
                    onChange={(event) => onFilterDraftChange({ ...filterDraft, vessel: event.target.value })}
                  >
                    <option value="">---Select from list---</option>
                    {vesselOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.fpActions}>
                  <button
                    className={`${styles.fpBtn} ${styles.fpBtnOutline}`}
                    type="button"
                    onClick={() => {
                      onFilterClear();
                    }}
                  >
                    Clear
                  </button>
                  <button
                    className={`${styles.fpBtn} ${styles.fpBtnNavy}`}
                    type="button"
                    onClick={() => {
                      onFilterApply();
                      setFilterOpen(false);
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>,
              document.body,
            )
            : null}
        </div>
        <button className={styles.btnRun} type="button" onClick={onRun}>
          Run
        </button>
        <span className={`${styles.runFlash} ${runFlash ? styles.runFlashShow : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Applied
        </span>
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
