import { Router } from 'express';

import auth from '../../middlewares/auth.js';
import { getMe, updateMe } from './user.controller.js';

const userRouter = Router();

userRouter.get('/me', auth(), getMe);
userRouter.patch('/me', auth(), updateMe);

export default userRouter;
