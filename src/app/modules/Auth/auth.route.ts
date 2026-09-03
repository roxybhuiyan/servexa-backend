import { Router } from 'express';

import auth from '../../middlewares/auth.js';
import { login, logout, me, refreshToken, register } from './auth.controller.js';

const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/refresh-token', refreshToken);
authRouter.post('/logout', logout);
authRouter.get('/me', auth(), me);

export default authRouter;
