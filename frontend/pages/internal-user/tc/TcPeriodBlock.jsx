import React from 'react';
import { CardSelect, DmyDateInput, RowAddButton, RowDelButton } from '@bainbridge/shared-ui';
import styles from './TcPages.module.css';

function Field({ label, children, className = '', id }) {
  return (
    <div className={`${styles.field} ${className}`.trim()} data-estimate-field-wrap={id || undefined}>
      <label htmlFor={id || undefined}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  readOnly = false,
  placeholder = '',
  type = 'text',
  className = '',
  id,
}) {
  return (
    <Field label={label} className={className} id={id}>
      <input
        id={id}
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        className={readOnly ? styles.inputReadonly : undefined}
      />
    </Field>
  );
}

function TableCardSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select',
  disabled = false,
  className = '',
  id,
  ariaLabel,
}) {
  return (
    <div className={(className || styles.tableCardSelect).trim()}>
      <CardSelect
        id={id}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        align="start"
        ariaLabel={ariaLabel || placeholder}
        tone="muted"
      />
    </div>
  );
}

function TsecCard({ theme = 'navy', tab, className = '', children }) {
  const themeClass = theme === 'tcdLight'
    ? styles.tsecTcdLight
    : theme === 'tcdMid'
      ? styles.tsecTcdMid
      : styles.tsecNavy;
  const tabClass = theme === 'tcdLight'
    ? styles.tsecTabTcdLight
    : theme === 'tcdMid'
      ? styles.tsecTabTcdMid
      : styles.tsecTabNavy;
  return (
    <div className={`${styles.tsecCard} ${themeClass} ${className}`.trim()}>
      <span className={`${styles.tsecTab} ${tabClass}`}>{tab}</span>
      {children}
    </div>
  );
}

/**
 * One TC period unit: TC Terms + Trip Schedule + Off Hire (mockup tcd light/mid/navy cards).
 * Primary period (isPrimary) maps to top-level form fields used by calc/save.
 */
export default function TcPeriodBlock({
  isPrimary = false,
  periodNumber,
  onRemove,
  terms = {},
  onTermChange,
  hirePeriods = [],
  hireTotals,
  dailyHireFallback = '',
  onPatchHire,
  onAddHire,
  onRemoveHire,
  offHires = [],
  offTotals,
  onPatchOff,
  onAddOff,
  onRemoveOff,
  onPatchOffBunker,
  onAddOffBunkers,
  onRemoveOffBunker,
  resolveHirePeriod,
  resolveOffHire,
  emptyHire,
  emptyOff,
  emptyOffBunker,
  currencyOptions = [],
  payableByOptions = [],
  vendorOptions = [],
  bunkerOptions = [],
  gradeSelectClass,
  sortBunkersVlsfoFirst,
  readOnly = false,
}) {
  const hireRows = hirePeriods?.length ? hirePeriods : [emptyHire];
  const offRows = offHires?.length ? offHires : [emptyOff];
  const idPrefix = isPrimary ? '' : `ext${periodNumber}_`;

  return (
    <div className={styles.tcdPeriodBlock}>
      {!isPrimary ? (
        <div className={styles.tcdPeriodHead}>
          <span className={styles.tcdPeriodLabel}>Period {periodNumber}</span>
          {!readOnly && onRemove ? (
            <button type="button" className={styles.tcdPeriodRemove} onClick={onRemove} title="Remove period">
              Remove
            </button>
          ) : null}
        </div>
      ) : null}

      <TsecCard theme="tcdLight" tab="TC Terms">
        <div className={styles.tcDetailsGrid} style={{ marginTop: 0 }}>
          <Field label={isPrimary ? 'Laycan From/To *' : 'Laycan From/To'} className={styles.laycanWide}>
            <div className={styles.dateRangePair}>
              <DmyDateInput
                id={isPrimary ? 'laycanFrom' : undefined}
                value={terms.laycanFrom || ''}
                onChange={(v) => onTermChange('laycanFrom', v)}
                enableTime
                disabled={readOnly}
              />
              <DmyDateInput
                id={isPrimary ? 'laycanTo' : undefined}
                value={terms.laycanTo || ''}
                onChange={(v) => onTermChange('laycanTo', v)}
                enableTime
                disabled={readOnly}
              />
            </div>
          </Field>
          <Field label={isPrimary ? 'Hire Currency *' : 'Hire Currency'} id={isPrimary ? 'exchangeCurrency' : undefined}>
            <CardSelect
              id={isPrimary ? 'exchangeCurrency' : undefined}
              options={currencyOptions}
              value={terms.exchangeCurrency}
              onChange={(v) => onTermChange('exchangeCurrency', v)}
              placeholder="Currency"
              ariaLabel="Hire currency"
              disabled={readOnly}
            />
          </Field>
          <TextInput
            label="X-rate to USD"
            value={terms.exchangeRate}
            onChange={(v) => onTermChange('exchangeRate', v)}
            readOnly={readOnly}
          />
          <TextInput
            id={isPrimary ? 'delRangePort' : undefined}
            label={isPrimary ? 'Del Port/Range *' : 'Del Port/Range'}
            value={terms.delRangePort}
            onChange={(v) => onTermChange('delRangePort', v)}
            readOnly={readOnly}
          />
          <TextInput
            id={isPrimary ? 'reDelRange' : undefined}
            label={isPrimary ? 'Re-Del Port/Range *' : 'Re-Del Port/Range'}
            value={terms.reDelRange}
            onChange={(v) => onTermChange('reDelRange', v)}
            readOnly={readOnly}
          />
          <TextInput
            id={isPrimary ? 'ballastBonus' : undefined}
            label="Ballast Bonus ($)"
            value={terms.ballastBonus}
            onChange={(v) => onTermChange('ballastBonus', v)}
            readOnly={readOnly}
          />
          <TextInput
            label="CVE/Month ($)"
            value={terms.cveMonth}
            onChange={(v) => onTermChange('cveMonth', v)}
            readOnly={readOnly}
          />
          <TextInput
            id={isPrimary ? 'ilohcUsd' : undefined}
            label={isPrimary ? 'ILOHC *' : 'ILOHC'}
            value={terms.ilohcUsd}
            onChange={(v) => onTermChange('ilohcUsd', v)}
            readOnly={readOnly}
          />
          <TextInput
            label="AD Comm (%)"
            value={terms.addComm}
            onChange={(v) => onTermChange('addComm', v)}
            readOnly={readOnly}
          />
          <TextInput
            label="Brokerage (%)"
            value={terms.brokerComm}
            onChange={(v) => onTermChange('brokerComm', v)}
            readOnly={readOnly}
          />
          <Field label={isPrimary ? 'Brokerage Paid By *' : 'Brokerage Paid By'} id={isPrimary ? 'broCommPayable' : undefined}>
            <CardSelect
              id={isPrimary ? 'broCommPayable' : undefined}
              options={payableByOptions}
              value={terms.broCommPayable}
              onChange={(v) => onTermChange('broCommPayable', v)}
              placeholder="Select"
              ariaLabel="Brokerage paid by"
              disabled={readOnly}
            />
          </Field>
        </div>
      </TsecCard>

      <TsecCard theme="tcdMid" tab="Trip Schedule" className={styles.tsecTripSchedule}>
        <div
          className={styles.fieldGrid}
          style={{ '--cols': '1.3fr 1.3fr 0.6fr 0.9fr 1fr 64px', marginTop: 0 }}
        >
          <div className={styles.fgHead}>Delivery Date (From) *</div>
          <div className={styles.fgHead}>Redelivery Date (To) *</div>
          <div className={styles.fgHead}>Days</div>
          <div className={styles.fgHead}>Hire ($/day) *</div>
          <div className={styles.fgHead}>Hire Amt ($)</div>
          <div className={styles.fgHead} />
          {hireRows.map((row, index) => {
            const resolved = hireTotals?.rows?.[index] || resolveHirePeriod(row);
            return (
              <React.Fragment key={`${idPrefix}hire-${index}`}>
                <div className={styles.fgCell}>
                  <DmyDateInput
                    id={isPrimary && index === 0 ? 'hireDelDate_0' : undefined}
                    value={row.delDate || ''}
                    onChange={(v) => onPatchHire(index, { delDate: v })}
                    enableTime
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.fgCell}>
                  <DmyDateInput
                    id={isPrimary && index === 0 ? 'hireReDelDate_0' : undefined}
                    value={row.reDelDate || ''}
                    onChange={(v) => onPatchHire(index, { reDelDate: v })}
                    enableTime
                    disabled={readOnly}
                  />
                </div>
                <div className={styles.fgCell}>
                  <input
                    value={resolved.days || ''}
                    onChange={(e) => onPatchHire(index, { days: e.target.value })}
                    readOnly={readOnly || Boolean(row.delDate && row.reDelDate)}
                    className={(readOnly || (row.delDate && row.reDelDate)) ? styles.inputReadonly : undefined}
                    placeholder="0"
                  />
                </div>
                <div className={styles.fgCell}>
                  <input
                    id={isPrimary && index === 0 ? 'hireRate_0' : undefined}
                    value={row.hireRate || ''}
                    onChange={(e) => onPatchHire(index, { hireRate: e.target.value })}
                    readOnly={readOnly}
                    className={readOnly ? styles.inputReadonly : undefined}
                    placeholder="0.00"
                  />
                </div>
                <div className={styles.fgCell}>
                  <input
                    value={resolved.amount || (isPrimary ? dailyHireFallback : '')}
                    readOnly
                    className={styles.inputReadonly}
                    placeholder="0.00"
                  />
                </div>
                <div className={styles.fgCell}>
                  {!readOnly ? (
                    <div className="rowActions">
                      <RowAddButton title="Add a new trip" onClick={onAddHire} />
                      <RowDelButton title="Delete row" onClick={() => onRemoveHire(index)} />
                    </div>
                  ) : null}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <div className={styles.tsecTotalRow}>
          <span className={styles.tsecTotalLabel}>Total</span>
          <span>{hireTotals?.totalDays || '0'} days / {hireTotals?.totalAmt || '0.00'}</span>
        </div>
      </TsecCard>

      <TsecCard theme="navy" tab="Off Hire">
        <div className={styles.offhireList}>
          {offRows.map((row, index) => {
            const resolved = resolveOffHire(row);
            const showBunkers = row.bunkersOpen || (row.bunkers || []).length > 0;
            return (
              <div key={`${idPrefix}off-${index}`} className={styles.offhireItem}>
                <div
                  className={styles.fieldGrid}
                  style={{ '--cols': '1.8fr 1fr 1fr 0.55fr 0.8fr 1.6fr 0.9fr 44px', marginTop: index === 0 ? 0 : undefined }}
                >
                  {index === 0 ? (
                    <>
                      <div className={styles.fgHead}>Reason</div>
                      <div className={styles.fgHead}>From</div>
                      <div className={styles.fgHead}>To</div>
                      <div className={styles.fgHead}>Days</div>
                      <div className={styles.fgHead}>Rate/Day</div>
                      <div className={styles.fgHead}>Vendor</div>
                      <div className={styles.fgHead}>Amount</div>
                      <div className={styles.fgHead} />
                    </>
                  ) : null}
                  <div className={styles.fgCell}>
                    <input
                      value={row.reason || ''}
                      onChange={(e) => onPatchOff(index, { reason: e.target.value })}
                      placeholder="Description"
                      readOnly={readOnly}
                      className={readOnly ? styles.inputReadonly : undefined}
                    />
                  </div>
                  <div className={styles.fgCell}>
                    <DmyDateInput
                      value={row.from || ''}
                      onChange={(v) => onPatchOff(index, { from: v })}
                      enableTime
                      disabled={readOnly}
                    />
                  </div>
                  <div className={styles.fgCell}>
                    <DmyDateInput
                      value={row.to || ''}
                      onChange={(v) => onPatchOff(index, { to: v })}
                      enableTime
                      disabled={readOnly}
                    />
                  </div>
                  <div className={styles.fgCell}>
                    <input
                      value={resolved.days || ''}
                      onChange={(e) => onPatchOff(index, { days: e.target.value })}
                      readOnly={readOnly || Boolean(row.from && row.to)}
                      className={(readOnly || (row.from && row.to)) ? styles.inputReadonly : undefined}
                    />
                  </div>
                  <div className={styles.fgCell}>
                    <input
                      value={row.hireRate || ''}
                      onChange={(e) => onPatchOff(index, { hireRate: e.target.value })}
                      readOnly={readOnly}
                      className={readOnly ? styles.inputReadonly : undefined}
                    />
                  </div>
                  <div className={styles.fgCell}>
                    <TableCardSelect
                      options={vendorOptions}
                      value={row.vendorId || ''}
                      onChange={(v) => onPatchOff(index, { vendorId: v })}
                      disabled={readOnly}
                      placeholder="Select"
                      ariaLabel="Off hire vendor"
                    />
                  </div>
                  <div className={styles.fgCell}>
                    <input value={resolved.amount || ''} readOnly className={styles.inputReadonly} />
                  </div>
                  <div className={styles.fgCell}>
                    {!readOnly ? (
                      <div className="rowActions">
                        <RowDelButton
                          title="Delete this off-hire item"
                          onClick={() => onRemoveOff(index)}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className={styles.offhireBunkers}>
                  {showBunkers ? (
                    <div className={styles.offhireBunkersInner}>
                      <div
                        className={styles.fieldGrid}
                        style={{ '--cols': '1.2fr 0.8fr 0.9fr 1fr 44px' }}
                      >
                        <div className={styles.fgHead}>Grade</div>
                        <div className={styles.fgHead}>Qty (MT)</div>
                        <div className={styles.fgHead}>Price (/MT)</div>
                        <div className={styles.fgHead}>Amount</div>
                        <div className={styles.fgHead} />
                        {(row.bunkers?.length ? row.bunkers : [emptyOffBunker]).map((bunker, bIndex) => {
                          const sorted = sortBunkersVlsfoFirst(bunkerOptions);
                          const gradeName = bunker.gradeName
                            || sorted.find((b) => String(b.id) === String(bunker.bunkerId))?.name
                            || '';
                          return (
                            <React.Fragment key={`${idPrefix}ohb-${index}-${bIndex}`}>
                              <div className={styles.fgCell}>
                                <TableCardSelect
                                  options={[
                                    ...sorted,
                                    ...(bunker.bunkerId
                                      && !sorted.some((b) => String(b.id) === String(bunker.bunkerId))
                                      ? [{ id: String(bunker.bunkerId), name: gradeName || `Grade #${bunker.bunkerId}` }]
                                      : []),
                                  ]}
                                  value={bunker.bunkerId || ''}
                                  onChange={(v) => {
                                    const match = sorted.find((b) => String(b.id) === String(v));
                                    onPatchOffBunker(index, bIndex, {
                                      bunkerId: v,
                                      gradeName: match?.name || '',
                                    });
                                  }}
                                  disabled={readOnly}
                                  className={gradeSelectClass(gradeName)}
                                  placeholder="Select"
                                  ariaLabel="Off hire bunker grade"
                                />
                              </div>
                              <div className={styles.fgCell}>
                                <input
                                  value={bunker.qty || ''}
                                  onChange={(e) => onPatchOffBunker(index, bIndex, { qty: e.target.value })}
                                  readOnly={readOnly}
                                  className={readOnly ? styles.inputReadonly : undefined}
                                />
                              </div>
                              <div className={styles.fgCell}>
                                <input
                                  value={bunker.price || ''}
                                  onChange={(e) => onPatchOffBunker(index, bIndex, { price: e.target.value })}
                                  readOnly={readOnly}
                                  className={readOnly ? styles.inputReadonly : undefined}
                                />
                              </div>
                              <div className={styles.fgCell}>
                                <input value={bunker.amount || ''} readOnly className={styles.inputReadonly} />
                              </div>
                              <div className={styles.fgCell}>
                                {!readOnly ? (
                                  <div className="rowActions">
                                    <RowDelButton
                                      title="Delete bunker row"
                                      onClick={() => onRemoveOffBunker(index, bIndex)}
                                    />
                                  </div>
                                ) : null}
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  {!readOnly ? (
                    <button
                      type="button"
                      className={`${styles.tsecAddBtn} ${styles.tsecAddBtnSlate}`}
                      onClick={() => onAddOffBunkers(index)}
                    >
                      + Add Bunkers
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <div className={styles.tsecTotalRow}>
          <span className={styles.tsecTotalLabel}>Total</span>
          <span>{offTotals?.totalDays || '0'} days / {offTotals?.totalAmt || '0.00'}</span>
        </div>
        {!readOnly ? (
          <button
            type="button"
            className={`${styles.tsecAddBtn} ${styles.tsecAddBtnNavy}`}
            onClick={onAddOff}
          >
            + Add Reason
          </button>
        ) : null}
      </TsecCard>
    </div>
  );
}
