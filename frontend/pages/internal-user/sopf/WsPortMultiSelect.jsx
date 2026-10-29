import React, { useMemo } from 'react';
import PortSearchSelect from '../period-contract/PortSearchSelect.jsx';
import styles from './UpdateEstimatePage.module.css';

function parsePortList(value, label) {
  const ids = String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const names = String(label || '')
    .split(',')
    .map((part) => part.trim());
  return ids.map((id, index) => ({
    id,
    name: names[index] || id,
  }));
}

function joinPortIds(ports) {
  return ports.map((port) => port.id).join(',');
}

function joinPortNames(ports) {
  return ports.map((port) => port.name).join(', ');
}

export default function WsPortMultiSelect({
  value,
  label,
  onChange,
  searchPorts,
  readOnly = false,
  id,
  placeholder = 'Choose port…',
}) {
  const ports = useMemo(() => parsePortList(value, label), [value, label]);

  const updatePorts = (nextPorts) => {
    onChange?.(joinPortIds(nextPorts), joinPortNames(nextPorts));
  };

  const addPort = (portId, portName) => {
    if (!portId || ports.some((port) => String(port.id) === String(portId))) return;
    updatePorts([...ports, { id: String(portId), name: portName || String(portId) }]);
  };

  const removePort = (portId) => {
    updatePorts(ports.filter((port) => String(port.id) !== String(portId)));
  };

  if (readOnly) {
    return (
      <div className={styles.wsPortChipBox}>
        {ports.length ? ports.map((port) => (
          <span key={port.id} className={styles.wsPortChip}>{port.name}</span>
        )) : '—'}
      </div>
    );
  }

  return (
    <div className={styles.wsPortChipBox} data-estimate-field-wrap={id || undefined}>
      {ports.map((port) => (
        <span key={port.id} className={styles.wsPortChip}>
          <span className={styles.wsPortChipLabel}>{port.name}</span>
          <button
            type="button"
            className={styles.wsPortChipRemove}
            onClick={() => removePort(port.id)}
            aria-label={`Remove ${port.name}`}
          >
            ×
          </button>
        </span>
      ))}
      <PortSearchSelect
        id={id}
        value=""
        label=""
        clearable={false}
        placeholder={placeholder}
        searchPorts={searchPorts}
        onChange={addPort}
      />
    </div>
  );
}
