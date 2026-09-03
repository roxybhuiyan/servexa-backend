import { Router } from 'express';

import { getPublic, listPublic } from './service.controller.js';
import availabilityRouter from '../Availability/availability.route.js';

const serviceRouter = Router();
serviceRouter.get('/', listPublic);
serviceRouter.use('/', availabilityRouter);
serviceRouter.get('/:id', getPublic);
export default serviceRouter;
