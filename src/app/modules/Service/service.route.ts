import { Router } from 'express';

import { getPublic, listPublic } from './service.controller.js';

const serviceRouter = Router();
serviceRouter.get('/', listPublic);
serviceRouter.get('/:id', getPublic);
export default serviceRouter;
