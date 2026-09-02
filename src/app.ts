import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import apiV1Router from './app/routes/index.js';
import sendResponse from './shared/sendResponse.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
);

app.get('/health', (_req: Request, res: Response) => {
  sendResponse(res, {
    statusCode: 200,
    message: 'Servexa API is healthy',
    data: null,
  });
});

app.use('/api/v1', apiV1Router);

// Placeholder for the future centralized global error handler.
app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  next(error);
});

export default app;
