import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler';
import apiV1Router from './routes';
import { getCorsOptions } from './utils/cors';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(getCorsOptions()));
app.use(express.json());
app.use(cookieParser());

app.use('/api/v1', apiV1Router);

app.use(errorHandler);

export default app;
