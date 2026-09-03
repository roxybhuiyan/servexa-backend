import { Router } from 'express';

import { UserRole } from '../../../generated/prisma/enums.js';
import auth from '../../middlewares/auth.js';
import { getMe, getPublicProfile, updateMe } from './provider.controller.js';
import { createMine, deleteMine, listMine, updateMine } from '../Service/service.controller.js';
import {
  createMine as createAvailability,
  deleteMine as deleteAvailability,
  listMine as listAvailability,
  updateMine as updateAvailability,
} from '../Availability/availability.controller.js';
import { accept, complete, getProviderMine, listProviderMine, reject, start } from '../Booking/booking.controller.js';

const providerRouter = Router();

providerRouter.get('/me', auth(UserRole.PROVIDER), getMe);
providerRouter.patch('/me', auth(UserRole.PROVIDER), updateMe);
providerRouter.get('/me/bookings', auth(UserRole.PROVIDER), listProviderMine);
providerRouter.get('/me/bookings/:id', auth(UserRole.PROVIDER), getProviderMine);
providerRouter.patch('/me/bookings/:id/accept', auth(UserRole.PROVIDER), accept);
providerRouter.patch('/me/bookings/:id/reject', auth(UserRole.PROVIDER), reject);
providerRouter.patch('/me/bookings/:id/start', auth(UserRole.PROVIDER), start);
providerRouter.patch('/me/bookings/:id/complete', auth(UserRole.PROVIDER), complete);
providerRouter.get('/me/availability', auth(UserRole.PROVIDER), listAvailability);
providerRouter.post('/me/availability', auth(UserRole.PROVIDER), createAvailability);
providerRouter.patch('/me/availability/:id', auth(UserRole.PROVIDER), updateAvailability);
providerRouter.delete('/me/availability/:id', auth(UserRole.PROVIDER), deleteAvailability);
providerRouter.get('/me/services', auth(UserRole.PROVIDER), listMine);
providerRouter.post('/me/services', auth(UserRole.PROVIDER), createMine);
providerRouter.patch('/me/services/:id', auth(UserRole.PROVIDER), updateMine);
providerRouter.delete('/me/services/:id', auth(UserRole.PROVIDER), deleteMine);
providerRouter.get('/:id', getPublicProfile);

export default providerRouter;
