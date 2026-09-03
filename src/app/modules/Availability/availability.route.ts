import { Router } from 'express';

import { listPublic } from './availability.controller.js';

const availabilityRouter = Router();

availabilityRouter.get('/:serviceId/availability', listPublic);

export default availabilityRouter;
