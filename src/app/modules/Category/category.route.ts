import { Router } from 'express';

import { listPublicCategories } from './category.controller.js';

const categoryRouter = Router();

categoryRouter.get('/', listPublicCategories);

export default categoryRouter;
