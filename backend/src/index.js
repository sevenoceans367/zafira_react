import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api.js';
import { attachmentDir } from './utils/ticketAttachments.js';
import { ATTACHMENT_PUBLIC_PREFIX } from './utils/attachmentUrl.js';
import { dbConfig, isDbConfigured } from './config.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(ATTACHMENT_PUBLIC_PREFIX, express.static(attachmentDir));
app.use('/attachment', express.static(attachmentDir));

app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
  if (isDbConfigured()) {
    console.log(`Database: ${dbConfig.user}@${dbConfig.host}/${dbConfig.database}`);
  } else {
    console.log('Database: not configured — using mock data (set backend/.env)');
  }
});
