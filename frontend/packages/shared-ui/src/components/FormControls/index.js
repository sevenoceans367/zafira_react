/**
 * Shared form UI kit — single source for inputs, selects, textareas,
 * labeled fields, and list-page filter bars.
 *
 * Rules for future pages:
 * - Use TextInput / Select / Textarea / Field / FilterBar / FilterField from
 *   `@bainbridge/shared-ui` for form chrome.
 * - Use Button, PageHeaderSearch, DmyDateInput, StatusBadge from the same package.
 * - Do not redeclare `.input` / `.filterField` / button chrome in page CSS modules.
 * - Tokens live in `global.css`; component layout lives in FormControls.module.css.
 */

export { default as TextInput } from './TextInput.jsx';
export { default as Select } from './Select.jsx';
export { default as Textarea } from './Textarea.jsx';
export { default as Field } from './Field.jsx';
export { FilterBar, FilterField } from './FilterBar.jsx';
