import React, { useEffect, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button, HeaderFilterControls } from '@bainbridge/shared-ui';
import { appPath } from '@bainbridge/shared-routing';
import PageHeaderActions from '../PageHeaderActions.jsx';
import { usePageHeaderHeading } from '../PageHeaderContext.jsx';
import { getFixtureTypeLabel } from './estimateDetail.constants.js';
import headingStyles from '../ops/VoyageOpsHeading.module.css';
import styles from './UpdateEstimatePage.module.css';

const ESTIMATE_FORM_ID = 'estimate-worksheet-form';

const HOME_CRUMB = { label: 'Home', href: appPath('/') };
const SOPF_CRUMB = { label: 'SOPF', href: appPath('/internal-user/sopf/estimate_list') };
const SPOT_CRUMB = { label: 'Spot Business', href: appPath('/internal-user/sopf/estimate_list') };

const ANCHOR_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="5" r="3" />
    <path d="M12 22V8" />
    <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
  </svg>
);

function estimateModeLabel(mode) {
  if (mode === 'add') return 'Add Estimate';
  if (mode === 'view') return 'View Estimate';
  return 'Edit Estimate';
}

/** Injects Back (+ optional Calculate / Submit) into the layout page header. */
export default function EstimateDetailHeaderActions({
  listHref,
  disabled = false,
  onCalculate,
  showSubmit = false,
  formId = ESTIMATE_FORM_ID,
  backLabel = 'Back',
}) {
  return (
    <PageHeaderActions deps={[listHref, disabled, onCalculate, showSubmit, formId, backLabel]}>
      <HeaderFilterControls>
        <Button variant="outline" label={backLabel} href={listHref} disabled={disabled} />
        {typeof onCalculate === 'function' ? (
          <Button
            type="button"
            variant="outlineAccent"
            label="Calculate"
            onClick={onCalculate}
            disabled={disabled}
          />
        ) : null}
        {showSubmit ? (
          <Button
            type="submit"
            variant="submit"
            label="Save"
            form={formId}
            disabled={disabled}
          />
        ) : null}
      </HeaderFilterControls>
    </PageHeaderActions>
  );
}

export function EstimateDetailFooterActions({
  listHref,
  disabled = false,
}) {
  return (
    <div className={styles.actions}>
      <Button variant="close" label="Cancel" href={listHref} ariaLabel="Cancel" disabled={disabled} />
      <Button type="submit" variant="submit" label="Save" disabled={disabled} />
    </div>
  );
}

/** Chip voyage segment: `VOY {voyage}` or estimate fallback. */
export function formatVcInChipLabel(voyageNo = '', estimateNo = 1) {
  const voy = String(voyageNo || '').trim();
  const est = Number(estimateNo) > 0 ? Number(estimateNo) : 1;
  return voy ? `VOY ${voy}` : `Est ${est}`;
}

/** @deprecated Prefer formatVcInChipLabel + EstimateVcInHeading chip header. */
export function formatVcInHeading(voyageNo = '', estimateNo = 1) {
  return `VCIN → ${formatVcInChipLabel(voyageNo, estimateNo)}`;
}

/** Page header: “VC-in” title + grey chip `VCIN · VOY … · Vessel`. */
export function EstimateVcInHeading({
  voyageNo = '',
  estimateNo = 1,
  vesselName = '',
  chipHref = '',
  /** Parent estimate mode for breadcrumb: 'edit' | 'view' */
  estimateMode = 'edit',
}) {
  const setHeading = usePageHeaderHeading();
  const chipLabel = formatVcInChipLabel(voyageNo, estimateNo);
  const modeLabel = estimateModeLabel(estimateMode);
  const vessel = String(vesselName || '').trim();
  useLayoutEffect(() => {
    setHeading({
      title: (
        <span className={headingStyles.headerTitleStack}>
          <span className={headingStyles.headerTitleText}>VC-in</span>
          <span className={headingStyles.headerVoyageChip}>
            {ANCHOR_ICON}
            <span className={headingStyles.headerVcType}>VCIN</span>
            <span className={headingStyles.vcSep}>·</span>
            {chipHref ? (
              <Link
                to={chipHref}
                className={headingStyles.headerVoyLink}
                title="Open voyage worksheet"
              >
                {chipLabel}
              </Link>
            ) : chipLabel}
            {vessel ? (
              <>
                <span className={headingStyles.vcSep}>·</span>
                {vessel}
              </>
            ) : null}
          </span>
        </span>
      ),
      // AppHeader appends currentPage after breadcrumbs — do not repeat the leaf in the trail.
      currentPage: 'VC-in',
      breadcrumbs: [
        HOME_CRUMB,
        SOPF_CRUMB,
        SPOT_CRUMB,
        { label: modeLabel, href: chipHref || undefined },
      ],
    });
    return undefined;
  }, [setHeading, chipLabel, chipHref, modeLabel, vessel]);
  useEffect(() => () => setHeading(null), [setHeading]);
  return null;
}

/**
 * SOPF Spot estimate crumbs: SOPF › Spot Business › Add|Edit|View Estimate › {Contract Type}.
 * Skip on VC-in (EstimateVcInHeading owns crumbs) and COA/period add flows.
 */
export function EstimateSpotBreadcrumbSync({ mode = 'edit', fixtureTypeId = '' }) {
  const setHeading = usePageHeaderHeading();
  const modeLabel = estimateModeLabel(mode);
  const contractLabel = getFixtureTypeLabel(fixtureTypeId);
  useLayoutEffect(() => {
    setHeading({
      title: 'Spot Estimate',
      // Leaf is currentPage only (AppHeader appends it after the trail).
      breadcrumbs: [
        HOME_CRUMB,
        SOPF_CRUMB,
        SPOT_CRUMB,
        { label: modeLabel },
      ],
      currentPage: contractLabel || modeLabel,
    });
    return undefined;
  }, [setHeading, modeLabel, contractLabel]);
  useEffect(() => () => setHeading(null), [setHeading]);
  return null;
}

export { ESTIMATE_FORM_ID };
