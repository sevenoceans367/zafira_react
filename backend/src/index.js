import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.js';
import { attachmentDir } from './utils/ticketAttachments.js';
import { ATTACHMENT_PUBLIC_PREFIX } from './utils/attachmentUrl.js';
import { dbConfig, isDbConfigured } from './config.js';
import { runTcContractTypeMigration } from './migrations/tcContractTypeMigration.js';
import { getPool } from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(ATTACHMENT_PUBLIC_PREFIX, express.static(attachmentDir));
app.use('/attachment', express.static(attachmentDir));

app.use('/api', apiRoutes);

async function start() {
  if (isDbConfigured()) {
    console.log(`Database: ${dbConfig.user}@${dbConfig.host}/${dbConfig.database}`);
    // Complete versioned migration before accepting traffic so writes never race boot.
    try {
      const result = await runTcContractTypeMigration(getPool());
      console.log(`[migration] tc_contract_type: ${result.state}${result.detail ? ` (${result.detail})` : ''}`);
    } catch (error) {
      console.error('[migration] tc_contract_type failed:', error.message);
    }
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
