/**
 * Master data modules shown under the Masters sidebar tree.
 * PHP file names are placeholders until legacy pages are ported.
 */
export const MASTERS_MODULES = [
  { id: 'agency-fee-records', label: 'Agency Fee Records', legacyPhp: 'agency_fee_record.php' },
  { id: 'baltic-dry-index', label: 'Baltic Dry Index', legacyPhp: 'baltic_route_list.php' },
  { id: 'bunker-grade', label: 'Bunker Grade', legacyPhp: 'bunker_grade.php' },
  { id: 'charterer-cost', label: 'Charterer Cost', legacyPhp: 'charterer_cost_master.php' },
  { id: 'coa-route', label: 'COA Route', legacyPhp: 'coaroute_list.php' },
  { id: 'contract-type', label: 'Contract Type', legacyPhp: 'contract_type_list.php' },
  { id: 'expense-type', label: 'Expense Type', legacyPhp: 'expense_type_list.php' },
  { id: 'elibrary-category', label: 'E-Library Category Master', legacyPhp: 'reference_category_list.php' },
  { id: 'elibrary-reference-type', label: 'E-Library Reference Type Master', legacyPhp: 'reference_type_list.php' },
  { id: 'invoice-status-list', label: 'Invoice Status List', legacyPhp: 'invoice_status_list.php' },
  { id: 'pc-ums-dwt-ratio', label: 'Estimated PC/UMS/DWT Ratio List', legacyPhp: 'estimated_ratio_list.php' },
  { id: 'law-arbitration-list', label: 'Law Arbitration List', legacyPhp: 'lawarbitration_list.php' },
  { id: 'load-options', label: 'Load Options', legacyPhp: 'loadoption_list.php' },
  { id: 'material', label: 'Material', legacyPhp: 'material_list.php' },
  { id: 'material-safety-data-sheets', label: 'Material Safety Data Sheets', legacyPhp: 'material_safety_data_list.php' },
  { id: 'necessary-approval', label: 'Necessary Approval', legacyPhp: 'necessary_approval.php' },
  { id: 'owner-related-cost', label: 'Owner Related Cost', legacyPhp: 'owner_related_cost.php' },
  { id: 'other-miscellaneous-cost', label: 'Other Miscellaneous Cost', legacyPhp: 'other_miscellaneous_cost.php' },
  { id: 'other-shipping-cost', label: 'Other Shipping Cost', legacyPhp: 'other_shipping_cost.php' },
  { id: 'panama-canal-capacity-tariff', label: 'Panama Canal Capacity Tariff Fee', legacyPhp: 'panama_canal_capacity.php' },
  { id: 'panama-canal-fixed-transit', label: 'Panama Canal Fixed Transit Fee', legacyPhp: 'panama_canal_fixed.php' },
  { id: 'port-cost-type', label: 'Port Cost Type', legacyPhp: 'port_cost_type.php' },
  { id: 'port-data', label: 'Port Data', legacyPhp: 'port_data.php' },
  { id: 'port-information', label: 'Port Information', legacyPhp: 'port_information.php' },
];

export function getMasterModule(id) {
  return MASTERS_MODULES.find((item) => item.id === id) ?? null;
}
