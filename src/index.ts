import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'uniz-outpass-service' });
});

import requestRoutes from './routes/request.routes';
app.use('/requests', requestRoutes);

app.listen(PORT, () => {
  console.log(`Outpass Service running on port ${PORT}`);
});
