import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const php = fs.readFileSync(path.join(__dirname, '../../php/view_vessel_tankers.php'), 'utf8');

const tabHeaders = [
  { id: 'certification', label: 'CERTIFICATION' },
  { id: 'crew', label: 'CREW MANAGEMENT' },
  { id: 'helicopters', label: 'HELICOPTERS' },
  { id: 'usa', label: 'FOR USA CALLS' },
  { id: 'cargo', label: 'CARGO AND BALLAST HANDLING' },
  { id: 'inert', label: 'INERT GAS AND CRUDE OIL WASHING' },
  { id: 'mooring', label: 'MOORING' },
  { id: 'misc', label: 'MISCELLANEOUS' },
];

function extractFields(chunk) {
  const fields = [];
  const regex = /([^<\n][^\n<]{3,}?)\s*<address>[\s\S]*?name="((?:txt|sel|rdo)[^"]+)"/g;
  let match;
  while ((match = regex.exec(chunk)) !== null) {
    const label = match[1]
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!label || label.length > 200) continue;
    fields.push({
      key: match[2],
      label,
      type: match[2].startsWith('rdo') ? 'radio' : match[2].startsWith('sel') ? 'select' : 'text',
    });
  }
  return fields;
}

const mainStart = php.indexOf('Vessel Description');
const tabsStart = php.indexOf('nav-tabs-custom');
const mainChunk = php.slice(mainStart, tabsStart);
const mainSections = [];
const mainRegex = /<h2 class="page-header">\s*([^<]+?)\s*<\/h2>([\s\S]*?)(?=<h2 class="page-header">|$)/g;
let mainMatch;
while ((mainMatch = mainRegex.exec(mainChunk)) !== null) {
  const title = mainMatch[1].trim();
  const fields = extractFields(mainMatch[2]);
  if (fields.length) mainSections.push({ title, fields });
}

const tabSections = [];
for (let i = 0; i < 8; i += 1) {
  const tabId = `tab_${i + 1}`;
  const start = php.indexOf(`id="${tabId}"`);
  const end = php.indexOf(`id="tab_${i + 2}"`, start + 1);
  const chunk = end > -1 ? php.slice(start, end) : php.slice(start, php.indexOf('</div><!-- /.tab-content -->', start));
  const sections = [];
  const sectionRegex = /<h2 class="page-header">\s*([^<]+?)\s*<\/h2>([\s\S]*?)(?=<h2 class="page-header">|$)/g;
  let sectionMatch;
  while ((sectionMatch = sectionRegex.exec(chunk)) !== null) {
    const fields = extractFields(sectionMatch[2]);
    if (fields.length) {
      sections.push({ title: sectionMatch[1].trim(), fields });
    }
  }
  const topFields = extractFields(chunk.split('<h2 class="page-header">')[0] ?? '');
  tabSections.push({
    id: tabHeaders[i].id,
    label: tabHeaders[i].label,
    sections: topFields.length ? [{ title: tabHeaders[i].label, fields: topFields }, ...sections] : sections,
  });
}

const certStart = php.indexOf('id="tab_1"');
const certEnd = php.indexOf('Documentation', certStart);
const certChunk = php.slice(certStart, certEnd);
const certTopFields = extractFields(certChunk);

const out = {
  mainSections,
  tabs: tabSections.map((tab, index) => {
    if (index !== 0) return tab;
    return {
      ...tab,
      certificates: true,
      sections: tab.sections.length
        ? tab.sections
        : [{ title: 'Certification', fields: certTopFields }],
    };
  }),
};

const outPath = path.join(__dirname, '../../frontend/pages/internal-user/fleet/tankerParticularsLayout.js');
fs.writeFileSync(
  outPath,
  `// Auto-generated from php/view_vessel_tankers.php\nexport const TANKER_PARTICULARS_LAYOUT = ${JSON.stringify(out, null, 2)};\n`,
);
console.log('main sections', mainSections.length);
console.log('tabs', tabSections.length);
tabSections.forEach((tab) => console.log(tab.label, tab.sections.reduce((n, s) => n + s.fields.length, 0)));
