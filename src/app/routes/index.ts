import { Router } from 'express';

import authRouter from '../modules/Auth/auth.route.js';

const apiV1Router = Router();

apiV1Router.use('/auth', authRouter);

export default apiV1Router;
