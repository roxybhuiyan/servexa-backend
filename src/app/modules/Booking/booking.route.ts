import { Router } from 'express';

import { UserRole } from '../../../generated/prisma/enums.js';
import auth from '../../middlewares/auth.js';
import { cancel, create, getMine, listMine } from './booking.controller.js';

const bookingRouter = Router();
bookingRouter.post('/', auth(UserRole.CUSTOMER), create);
bookingRouter.get('/me', auth(UserRole.CUSTOMER), listMine);
bookingRouter.patch('/:id/cancel', auth(UserRole.CUSTOMER), cancel);
bookingRouter.get('/:id', auth(UserRole.CUSTOMER), getMine);

export default bookingRouter;
