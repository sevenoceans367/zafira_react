import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@bainbridge/shared-ui';
import styles from './CompareSheetsDialog.module.css';

const THEMES = ['themeNavy', 'themeOrange', 'themeBlue', 'themePurple', 'themeBrown'];

function SoMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="19" fill="#fff" stroke="#274670" strokeWidth="2" />
      <circle cx="20" cy="20" r="14" fill="none" stroke="#F4652C" strokeWidth="2.5" />
      <text
        x="20"
        y="26"
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontWeight="700"
        fontSize="18"
        fill="#274670"
      >
        S
      </text>
    </svg>
  );
}

function SectionLabel({ children }) {
  return (
    <p className={styles.sectionLabel}>
      <span className={styles.dot} />
      {children}
    </p>
  );
}

function groupRows(rows = []) {
  const groups = [];
  const seen = new Map();
  (rows || []).forEach((row) => {
    const section = row.section || 'Parameters';
    if (!seen.has(section)) {
      seen.set(section, groups.length);
      groups.push({ section, rows: [] });
    }
    groups[seen.get(section)].rows.push(row);
  });
  return groups;
}

function cellClass(tone, extra = '') {
  const toneClass = tone === 'negative'
    ? styles.negative
    : tone === 'positive'
      ? styles.positive
      : '';
  return `${styles.colCell} ${toneClass} ${extra}`.trim();
}

export default function CompareSheetsDialog({
  open,
  loading = false,
  error = '',
  data = null,
  onClose,
  title = 'Compare Sheets',
  docTitle = 'Voyage Financials — Compare Sheets',
  headerFields = [],
  extraActions = null,
  onDownloadPdf,
  pdfLoading = false,
  renderLabel,
}) {
  const sheets = data?.sheets || [];
  const colCount = sheets.length + 2;
  const groups = useMemo(() => groupRows(data?.rows), [data?.rows]);

  if (!open) return null;

  return createPortal(
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-sheets-title"
        style={{ '--cols': Math.max(colCount, 1) }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.chrome}>
          <h4 id="compare-sheets-title" className={styles.chromeTitle}>
            <i className="bi bi-columns-gap" /> {title}
          </h4>
          <div className={styles.chromeActions}>
            {typeof onDownloadPdf === 'function' ? (
              <Button
                variant="outline"
                icon="download"
                ariaLabel={pdfLoading ? 'Generating PDF…' : 'Generate PDF'}
                className={styles.pdfIconBtn}
                onClick={onDownloadPdf}
                disabled={pdfLoading || loading || !data}
              />
            ) : null}
            {extraActions}
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
        </div>

        <div className={styles.body}>
          {error ? <div className={styles.error}>{error}</div> : null}
          {loading ? <p className={styles.loading}>Please wait...</p> : null}
          {!loading && data ? (
            <div className={styles.doc}>
              <div className={styles.docInner}>
                <div className={styles.docHeader}>
                  <div>
                    <p className={styles.eyebrow}>Seven Oceans PreFixture Platform</p>
                    <h1 className={styles.docTitle}>{docTitle}</h1>
                  </div>
                  <div className={styles.soLogo}>
                    <SoMark className={styles.soLogoMark} />
                    <div className={styles.soLogoWord}>
                      <b>SEVEN</b>
                      <span>OCEANS</span>
                    </div>
                  </div>
                </div>
                <hr className={styles.headerRule} />

                <div className={styles.overview}>
                  <div className={styles.overviewLabel}>Main Particulars</div>
                  <div className={styles.overviewBody}>
                    {headerFields.length ? (
                      <div className={styles.facts}>
                        {headerFields.map((field) => (
                          <div key={field.label}>
                            <div className={styles.factLabel}>{field.label}</div>
                            <div className={styles.factValue}>{field.value || '—'}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div
                      className={`${styles.row} ${styles.voyagecard}`}
                      style={{
                        gridTemplateColumns: `var(--label-col) repeat(${Math.max(sheets.length, 1)}, 1fr)`,
                      }}
                    >
                      <div className={styles.labelCell}>Sheets</div>
                      {sheets.map((sheet, index) => (
                        <div
                          key={sheet.fcaId || sheet.tcOutId || sheet.name || index}
                          className={`${styles.colCell} ${index % 2 === 0 ? styles.voy0 : styles.voy1}`}
                        >
                          <span className={styles.voyChip}>
                            {sheet.isFvf || sheet.isFixture ? 'Fixture' : `Sheet ${index + 1}`}
                          </span>
                          <div className={styles.sheetName}>{sheet.name || '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`${styles.row}`}>
                  <div className={styles.labelCell}>Sheet Name / Parameters</div>
                  {sheets.map((sheet, index) => (
                    <div
                      key={`head-${sheet.fcaId || sheet.tcOutId || index}`}
                      className={`${styles.colCell} ${styles.colHead} ${sheet.isFvf || sheet.isFixture ? styles.fixtureCol : styles.sheetCol}`}
                    >
                      {sheet.name}
                    </div>
                  ))}
                  <div className={`${styles.colCell} ${styles.colHead}`}>Diff.</div>
                  <div className={`${styles.colCell} ${styles.colHead}`}>Progressive</div>
                </div>

                {groups.map((group, groupIndex) => (
                  <div
                    key={group.section}
                    className={`${styles.section} ${styles[THEMES[groupIndex % THEMES.length]]}`}
                  >
                    <SectionLabel>{group.section}</SectionLabel>
                    {group.rows.map((row) => (
                      <div key={`${group.section}-${row.label}`} className={styles.row}>
                        <div className={styles.labelCell}>
                          {renderLabel ? renderLabel(row) : row.label}
                        </div>
                        {(row.values || []).map((value, index) => {
                          const empty = value === undefined || value === null || value === '';
                          const sheet = sheets[index];
                          return (
                            <div
                              key={`${row.label}-${index}`}
                              className={`${styles.colCell} ${empty ? styles.colCellEmpty : ''} ${
                                sheet?.isFvf || sheet?.isFixture ? styles.fixtureCol : styles.sheetCol
                              }`.trim()}
                            >
                              {empty ? '—' : value}
                            </div>
                          );
                        })}
                        <div className={cellClass(row.differenceTone)}>
                          {row.difference || '—'}
                        </div>
                        <div className={`${styles.colCell} ${row.progressive ? '' : styles.colCellEmpty}`}>
                          {row.progressive || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                <div className={`${styles.section} ${styles.themeNavy}`}>
                  <SectionLabel>Result</SectionLabel>
                  <div className={`${styles.row} ${styles.highlight}`}>
                    <div className={styles.labelCell}>P/L Difference</div>
                    {sheets.map((sheet, index) => (
                      <div key={`pl-${sheet.fcaId || sheet.tcOutId || index}`} className={styles.colCell} />
                    ))}
                    <div className={styles.colCell}>{data.plDifference || '—'}</div>
                    <div className={styles.colCell} />
                  </div>
                  <div className={`${styles.row} ${styles.highlight}`}>
                    <div className={styles.labelCell}>Actual P/L (Calculated - Difference)</div>
                    {sheets.map((sheet, index) => (
                      <div key={`apl-${sheet.fcaId || sheet.tcOutId || index}`} className={styles.colCell} />
                    ))}
                    <div className={styles.colCell}>{data.actualPl || '—'}</div>
                    <div className={styles.colCell} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {!loading && !data && !error ? (
            <p className={styles.empty}>No compare sheet data.</p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

