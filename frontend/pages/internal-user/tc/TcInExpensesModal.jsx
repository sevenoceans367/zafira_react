/**
 * Compatibility barrel — TC Hire Details UI lives in TcInHireRecapModal.
 * Prefer importing from `./TcInHireRecapModal.jsx` or `./tcInRecapCalcs.js`.
 */
export {
  EMPTY_TC_IN_BUNKER,
  EMPTY_TC_IN_HIRE,
  EMPTY_TC_IN_OFF,
  calcTcInFinalHireage,
  calcTcInGrossHireExpense,
  buildTcInRecapDraft,
} from './tcInRecapCalcs.js';

export { default } from './TcInHireRecapModal.jsx';
