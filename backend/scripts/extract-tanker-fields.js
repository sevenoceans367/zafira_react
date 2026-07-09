import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const php = fs.readFileSync(path.join(__dirname, '../../php/view_vessel_tankers.php'), 'utf8');

const names = [...php.matchAll(/name="((?:txt|sel|rdo)[^"]+)"/g)].map((m) => m[1]);
const uniq = [...new Set(names)].filter(
  (n) => !/^selCert_|^txtIDate_|^txtLAIDate_|^txtEDate_|^attach_file_|^file1_|^name1_|^txtCRM/.test(n),
);

console.log(JSON.stringify(uniq, null, 2));
