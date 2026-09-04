import { Router } from 'express';
import { UserRole } from '../../../generated/prisma/enums.js';
import auth from '../../middlewares/auth.js';
import { initiate, status } from './payment.controller.js';
const paymentRouter = Router();
paymentRouter.post('/initiate/:bookingId', auth(UserRole.CUSTOMER), initiate);
paymentRouter.get('/booking/:bookingId', auth(UserRole.CUSTOMER), status);
export default paymentRouter;
