import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, CardSelect, useAlert } from '@bainbridge/shared-ui';
import { fetchVcBusinessTypes } from '../../../services/vcDashboard.js';
import {
  searchTodoVoyageByNumber,
  searchTodoVoyagesByVessel,
} from '../../../services/todoList.js';
import VesselSearchSelect from '../sopf/VesselSearchSelect.jsx';
import { resolveTodoVoyageHref } from './todoVoyageNavigation.js';
import styles from './SearchForVoyageModal.module.css';

const VOYAGE_TYPE_OPTIONS = [
  { id: '', name: '---Select Type---' },
  { id: 'VC', name: 'VC' },
  { id: 'TC', name: 'TC' },
  { id: 'COA', name: 'COA' },
];

const SEARCH_BY_OPTIONS = [
  { id: '', name: '---Select Search By---' },
  { id: '1', name: 'Voyage Number' },
  { id: '2', name: 'Vessel' },
];

export default function SearchForVoyageModal({ open, onClose }) {
  const alert = useAlert();
  const [businessTypes, setBusinessTypes] = useState([]);
  const [businessType, setBusinessType] = useState('');
  const [voyType, setVoyType] = useState('');
  const [searchBy, setSearchBy] = useState('');
  const [voyageNo, setVoyageNo] = useState('');
  const [vesselId, setVesselId] = useState('');
  const [vesselLabel, setVesselLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [vesselResults, setVesselResults] = useState(null);

  useEffect(() => {
    if (!open) return;
    setVoyType('');
    setSearchBy('');
    setVoyageNo('');
    setVesselId('');
    setVesselLabel('');
    setVesselResults(null);
    setLoading(false);
    (async () => {
      try {
        const types = await fetchVcBusinessTypes('3');
        const options = (types || []).map((row) => ({
          id: String(row.id ?? row.value ?? ''),
          name: row.name ?? row.label ?? '',
        })).filter((row) => row.id);
        setBusinessTypes([{ id: '', name: '---Select Business Type---' }, ...options]);
        setBusinessType(options[0]?.id || '');
      } catch {
        setBusinessTypes([{ id: '', name: '---Select Business Type---' }]);
        setBusinessType('');
      }
    })();
  }, [open]);

  if (!open) return null;

  const handleSearch = async () => {
    if (!voyType || !searchBy || !businessType) {
      await alert({
        title: 'Alert',
        message: 'Please ensure to select/fill Voyage No./Vessel, Business type, Voyage Type and Search by',
      });
      return;
    }

    if (searchBy === '1') {
      if (!String(voyageNo || '').trim()) {
        await alert({
          title: 'Alert',
          message: 'Please ensure to select/fill Voyage No./Vessel, Business type, Voyage Type and Search by',
        });
        return;
      }
      setLoading(true);
      try {
        const obj = await searchTodoVoyageByNumber({
          voyageNo: String(voyageNo).trim(),
          voyType,
          businessType,
        });
        if (obj?.res === 0) {
          await alert({ title: 'Alert', message: 'No Data Found' });
          return;
        }
        const href = resolveTodoVoyageHref(obj, { mode: 'voyage' });
        if (!href) {
          await alert({ title: 'Alert', message: 'No Data Found' });
          return;
        }
        onClose?.();
        window.location.href = href;
      } catch (err) {
        await alert({ title: 'Alert', message: err.message || 'Failed to search voyage.' });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!vesselId) {
      await alert({
        title: 'Alert',
        message: 'Please ensure to select/fill Voyage No./Vessel, Business type, Voyage Type and Search by',
      });
      return;
    }

    setLoading(true);
    try {
      const list = await searchTodoVoyagesByVessel({
        vesselId,
        voyType,
        businessType,
      });
      const rows = Array.isArray(list) ? list : [];
      if (!rows.length || rows.every((row) => row.res === 0)) {
        await alert({ title: 'Alert', message: 'No Data Found' });
        setVesselResults(null);
        return;
      }
      const links = rows
        .filter((row) => row.res !== 0)
        .map((row) => ({
          ...row,
          href: resolveTodoVoyageHref(row, { mode: 'vessel' }),
          label: `${row.Charterer || '—'} - ${row.voyage || ''} (${row.CP_DATE || ''})`,
        }))
        .filter((row) => row.href);
      if (!links.length) {
        await alert({ title: 'Alert', message: 'No Data Found' });
        setVesselResults(null);
        return;
      }
      setVesselResults(links);
    } catch (err) {
      await alert({ title: 'Alert', message: err.message || 'Failed to search voyages by vessel.' });
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="todo-voyage-search-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h4 id="todo-voyage-search-title" className={styles.title}>
            {vesselResults ? 'Search For Vessel' : 'Search For Voyage'}
          </h4>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {vesselResults ? (
            <div className={styles.results}>
              {vesselResults.map((row) => (
                <a key={`${row.voyage}-${row.status}-${row.year}`} className={styles.resultLink} href={row.href}>
                  {row.label}
                </a>
              ))}
            </div>
          ) : (
            <div className={styles.formStack}>
              <div>
                <div className={styles.fieldLabel}>Business Type</div>
                <div className={styles.cardSelect}>
                  <CardSelect
                    options={businessTypes}
                    value={businessType}
                    onChange={setBusinessType}
                    placeholder="Business Type"
                    ariaLabel="Business Type"
                    align="start"
                  />
                </div>
              </div>
              <div>
                <div className={styles.fieldLabel}>Voyage Type</div>
                <div className={styles.cardSelect}>
                  <CardSelect
                    options={VOYAGE_TYPE_OPTIONS}
                    value={voyType}
                    onChange={setVoyType}
                    placeholder="Voyage Type"
                    ariaLabel="Voyage Type"
                    align="start"
                  />
                </div>
              </div>
              <div>
                <div className={styles.fieldLabel}>Search By</div>
                <div className={styles.cardSelect}>
                  <CardSelect
                    options={SEARCH_BY_OPTIONS}
                    value={searchBy}
                    onChange={setSearchBy}
                    placeholder="Search By"
                    ariaLabel="Search By"
                    align="start"
                  />
                </div>
              </div>
              {searchBy === '2' ? (
                <div>
                  <div className={styles.fieldLabel}>Vessel</div>
                  <VesselSearchSelect
                    value={vesselId}
                    label={vesselLabel}
                    onSelect={(id, name) => {
                      setVesselId(id || '');
                      setVesselLabel(name || '');
                    }}
                  />
                </div>
              ) : null}
              {searchBy === '1' ? (
                <div>
                  <div className={styles.fieldLabel}>Enter Voyage Number</div>
                  <input
                    className={styles.textInput}
                    type="text"
                    value={voyageNo}
                    onChange={(e) => setVoyageNo(e.target.value)}
                    placeholder="Voyage Number"
                    autoComplete="off"
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {vesselResults ? (
            <Button type="button" variant="outline" label="Back" onClick={() => setVesselResults(null)} />
          ) : (
            <Button
              type="button"
              variant="primary"
              label={loading ? 'Searching…' : 'Search'}
              disabled={loading}
              onClick={handleSearch}
            />
          )}
          <Button type="button" variant="close" label="Close" onClick={onClose} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
