import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const php = fs.readFileSync(
  path.join(__dirname, '../../php/functions_internal_user_dryout.inc.php'),
  'utf8',
);

const fnStart = php.indexOf('function updateVesselMainMasterTankers()');
const fnEnd = php.indexOf('function getCPTypeList()', fnStart);
const fnBody = php.slice(fnStart, fnEnd);

const insertIdx = fnBody.indexOf('insert into vessel_master_tankers');
const sqlLine = fnBody.slice(insertIdx, fnBody.indexOf('mysql_query($sql2)', insertIdx));

const colMatch = sqlLine.match(/insert into vessel_master_tankers \(([^)]+)\) values \(/i);
if (!colMatch) {
  console.error('Could not parse columns');
  process.exit(1);
}

const columns = colMatch[1]
  .split(',')
  .map((c) => c.trim())
  .filter((c) => c !== 'VESSEL_IMO_ID' && c !== 'UPDATEONDATE');

const valuesStart = sqlLine.indexOf('values (') + 'values ('.length;
const values = sqlLine.slice(valuesStart, sqlLine.lastIndexOf(')'));

const valueRefs = [];
const re = /\$_REQUEST\['([^']+)'\]|\$(txt[A-Za-z0-9_]+)/g;
let match;
while ((match = re.exec(values)) !== null) {
  valueRefs.push(match[1] || match[2]);
}

if (columns.length !== valueRefs.length) {
  console.error(`Column/value mismatch: ${columns.length} columns vs ${valueRefs.length} values`);
  process.exit(1);
}

const map = {};
columns.forEach((col, index) => {
  map[valueRefs[index]] = col;
});

const outPath = path.join(__dirname, '../src/services/tankerParticularsFieldMap.js');
const content = `// Auto-generated from PHP updateVesselMainMasterTankers — do not edit by hand.
export const TANKER_REQUEST_TO_COLUMN = ${JSON.stringify(map, null, 2)};

export const TANKER_COLUMN_TO_REQUEST = Object.fromEntries(
  Object.entries(TANKER_REQUEST_TO_COLUMN).map(([requestKey, column]) => [column, requestKey]),
);

export const TANKER_DATE_FIELDS = new Set([
  'txtDOC',
  'txtDateDelivered',
  'txtClassSOCChnageDate',
  'txtDryDockDate',
  'txtNextDryDockDate',
  'txtSurveyDate',
  'txtDueSurveyDate',
  'txtAnnualSurveyDate',
  'txtExpiryStatDate',
  'txtLastPortStateDate',
  'txtLastSireDate',
  'txtLastCDIDate',
]);

export const TANKER_RADIO_FIELDS = new Set(
  Object.keys(TANKER_REQUEST_TO_COLUMN).filter((key) => key.startsWith('rdo')),
);

export const TANKER_SELECT_FIELDS = new Set(
  Object.keys(TANKER_REQUEST_TO_COLUMN).filter((key) => key.startsWith('sel')),
);
`;

fs.writeFileSync(outPath, content);
console.log(`Wrote ${Object.keys(map).length} mappings`);
