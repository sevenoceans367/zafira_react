import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.js';
import { attachmentDir } from './utils/ticketAttachments.js';
import { ATTACHMENT_PUBLIC_PREFIX } from './utils/attachmentUrl.js';
import { dbConfig, isDbConfigured } from './config.js';
import {
  getTcContractTypeMigrationState,
  runTcContractTypeMigration,
} from './migrations/tcContractTypeMigration.js';
import {
  getLaytimeNegotiationMigrationState,
  runLaytimeNegotiationMigration,
} from './migrations/laytimeNegotiationMigration.js';
import { getPool } from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(ATTACHMENT_PUBLIC_PREFIX, express.static(attachmentDir));
app.use('/attachment', express.static(attachmentDir));

app.use('/api', apiRoutes);

app.get('/healthz', (_req, res) => {
  if (!isDbConfigured()) {
    return res.json({ ok: true, db: false, tcContractType: 'n/a', laytimeNegotiation: 'n/a' });
  }
  const tcContractType = getTcContractTypeMigrationState();
  const laytimeNegotiation = getLaytimeNegotiationMigrationState();
  const ok = tcContractType === 'ready' && laytimeNegotiation === 'ready';
  return res.status(ok ? 200 : 503).json({ ok, db: true, tcContractType, laytimeNegotiation });
});

async function start() {
  if (isDbConfigured()) {
    console.log(`Database: ${dbConfig.user}@${dbConfig.host}/${dbConfig.database}`);
    // Fail closed: do not accept traffic if the versioned migration cannot complete.
    const result = await runTcContractTypeMigration(getPool());
    console.log(`[migration] tc_contract_type: ${result.state}${result.detail ? ` (${result.detail})` : ''}`);
    if (!result.ok) {
      console.error('[boot] CONTRACT_TYPE migration failed — refusing to listen.');
      process.exit(1);
    }
    const negotiation = await runLaytimeNegotiationMigration(getPool());
    console.log(`[migration] laytime_negotiation: ${negotiation.state}${negotiation.detail ? ` (${negotiation.detail})` : ''}`);
  } else {
    console.log('Database: not configured — using mock data (set backend/.env)');
  }

  app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error('[boot] failed:', error);
  process.exit(1);
});
