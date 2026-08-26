import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardSelect, HeaderFilterControls, PageHeaderSearch } from '@bainbridge/shared-ui';
import PageHeaderActions from '../PageHeaderActions.jsx';
import styles from './CombinedSoaPayablePage.module.css';

const CONTRACT_OPTIONS = [
  { id: 'all', name: 'All Trades' },
  { id: 'spot', name: 'Spot' },
  { id: 'tc', name: 'TC' },
];

const TYPE_COLORS = {
  all: '#8a93a0',
  spot: '#2e6fe8',
  tc: '#f4652c',
};

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function CombinedSoaPayableHeaderActions({
  search,
  onSearchChange,
  contractType = 'all',
  onContractTypeChange,
  year = 'all',
  onYearChange,
  yearOptions = [],
  canCreate = false,
  addPath = '',
}) {
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const years = useMemo(
    () => [{ id: 'all', name: 'All Years' }, ...yearOptions.filter((item) => item.id !== 'all')],
    [yearOptions],
  );

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

  return (
    <PageHeaderActions
      deps={[
        search,
        onSearchChange,
        contractType,
        onContractTypeChange,
        year,
        onYearChange,
        years,
        canCreate,
        addPath,
      ]}
    >
      <HeaderFilterControls>
        <PageHeaderSearch
          ref={searchRef}
          value={search}
          onChange={onSearchChange}
          placeholder="Search SOA No., vendor, PIC…"
        />
        <div className={styles.typeSelectWrap}>
          <span
            className={styles.typeDot}
            style={{ background: TYPE_COLORS[contractType] || TYPE_COLORS.all }}
            aria-hidden="true"
          />
          <CardSelect
            options={CONTRACT_OPTIONS}
            value={contractType}
            onChange={onContractTypeChange}
            placeholder="Contract type"
            ariaLabel="Contract type"
          />
        </div>
        <CardSelect
          options={years}
          value={year}
          onChange={onYearChange}
          placeholder="Year"
          ariaLabel="Year"
        />
        {canCreate && addPath ? (
          <button
            type="button"
            className={styles.btnAdd}
            onClick={() => navigate(addPath)}
          >
            <PlusIcon />
            Add New
          </button>
        ) : null}
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}
