import React from 'react';
import styles from './StatusBadge.module.css';
import {
  resolveContractStatusVariant,
  resolveFixtureStatusVariant,
  resolveMasterStatusVariant,
  resolveTicketStatusVariant,
  resolveWorkflowStatusVariant,
  STATUS_VARIANTS,
} from './statusBadgeUtils.js';

const VARIANT_CLASS = {
  success: styles.success,
  warning: styles.warning,
  neutral: styles.neutral,
  info: styles.info,
  primary: styles.primary,
};

const TONE_RESOLVERS = {
  ticket: resolveTicketStatusVariant,
  workflow: resolveWorkflowStatusVariant,
  master: resolveMasterStatusVariant,
  fixture: resolveFixtureStatusVariant,
};

/**
 * Soft status chip for tables and detail views (non-interactive).
 * Use `tone` for automatic variant mapping, or pass `variant` explicitly.
 */
const StatusBadge = ({
  label,
  children,
  variant,
  tone,
  contractOpen,
  className = '',
}) => {
  const text = children ?? label ?? '';
  if (!text) return null;

  let resolvedVariant = variant;
  if (!resolvedVariant && tone === 'contract') {
    resolvedVariant = resolveContractStatusVariant(Boolean(contractOpen));
  } else if (!resolvedVariant && tone && TONE_RESOLVERS[tone]) {
    resolvedVariant = TONE_RESOLVERS[tone](text);
  }
  if (!STATUS_VARIANTS.includes(resolvedVariant)) {
    resolvedVariant = 'neutral';
  }

  const isLongLabel = String(text).length > 15;

  return (
    <span
      className={[
        styles.badge,
        VARIANT_CLASS[resolvedVariant],
        isLongLabel ? styles.longLabel : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {text}
    </span>
  );
};

export default StatusBadge;
