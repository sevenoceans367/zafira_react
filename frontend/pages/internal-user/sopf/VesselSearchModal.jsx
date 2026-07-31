import React from 'react';
import { Button, useAlert } from '@bainbridge/shared-ui';
import { NAVIGATION_STATUSES } from './vesselPosition.constants.js';
import styles from './VesselSearchModal.module.css';

export default function VesselSearchModal({
  open,
  latitude,
  longitude,
  radius,
  navStatus,
  onRadiusChange,
  onNavStatusChange,
  onClose,
  onSubmit,
  submitting,
}) {
  const alert = useAlert();

  if (!open) return null;

  const toggleStatus = (index) => {
    const next = navStatus.includes(index)
      ? navStatus.filter((value) => value !== index)
      : [...navStatus, index];
    onNavStatusChange(next);
  };

  const handleSubmit = async () => {
    if (radius === '' || radius == null) {
      await alert({
        title: 'Missing Information',
        message: 'Please fill Radius!',
        confirmLabel: 'OK',
      });
      return;
    }
    if (Number(radius) <= 0) {
      await alert({
        title: 'Missing Information',
        message: 'Radius should be greater than zero',
        confirmLabel: 'OK',
      });
      return;
    }
    onSubmit();
  };

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vessel-search-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h4 id="vessel-search-title">
            <i className="bi bi-geo-alt-fill" aria-hidden /> Fleet
          </h4>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        </div>

        <div className={styles.body}>
          <div className="mb-3">
            <label className="form-label" htmlFor="vessel-latitude">Latitude</label>
            <input
              id="vessel-latitude"
              type="text"
              className="form-control"
              value={latitude}
              readOnly
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="vessel-longitude">Longitude</label>
            <input
              id="vessel-longitude"
              type="text"
              className="form-control"
              value={longitude}
              readOnly
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="vessel-radius">
              Radius <i>(in km)</i>
            </label>
            <input
              id="vessel-radius"
              type="number"
              className="form-control"
              value={radius}
              min="1"
              onChange={(event) => onRadiusChange(event.target.value)}
            />
          </div>
          <div className="mb-2">
            <label className="form-label">Navigation Status</label>
            <div className={styles.statusList}>
              {NAVIGATION_STATUSES.map((label, index) => (
                <label key={label} className={styles.statusOption}>
                  <input
                    type="checkbox"
                    checked={navStatus.includes(index)}
                    onChange={() => toggleStatus(index)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <Button variant="close" label="Close" onClick={onClose} disabled={submitting} />
          <Button variant="primary" label="Submit" onClick={handleSubmit} disabled={submitting} />
        </div>
      </div>
    </div>
  );
}
