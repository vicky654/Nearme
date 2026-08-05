import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler';
import apiV1Router from './routes';
import { getCorsOptions } from './utils/cors';
import { chatUploadDirectory } from './middleware/chatUpload';

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(getCorsOptions()));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads/chat', express.static(chatUploadDirectory, {
  immutable: true,
  maxAge: '30d',
  fallthrough: false,
  setHeaders: (response, filePath) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (/\.(pdf|txt)$/i.test(filePath)) response.setHeader('Content-Disposition', 'attachment');
  },
}));

app.use('/api/v1', apiV1Router);

app.use(errorHandler);

export default app;
