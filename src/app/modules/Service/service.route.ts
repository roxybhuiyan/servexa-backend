import { Router } from 'express';

import { getPublic, listPublic } from './service.controller.js';
import availabilityRouter from '../Availability/availability.route.js';
import { publicService, serviceSummary } from '../Review/review.controller.js';

const serviceRouter = Router();
serviceRouter.get('/', listPublic);
serviceRouter.use('/', availabilityRouter);
serviceRouter.get('/:serviceId/reviews', publicService);
serviceRouter.get('/:serviceId/rating-summary', serviceSummary);
serviceRouter.get('/:id', getPublic);
export default serviceRouter;
