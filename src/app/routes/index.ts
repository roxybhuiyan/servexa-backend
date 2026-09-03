import { Router } from 'express';

import authRouter from '../modules/Auth/auth.route.js';
import adminRouter from '../modules/Admin/admin.route.js';
import providerRouter from '../modules/Provider/provider.route.js';
import userRouter from '../modules/User/user.route.js';
import categoryRouter from '../modules/Category/category.route.js';
import serviceRouter from '../modules/Service/service.route.js';

const apiV1Router = Router();

apiV1Router.use('/auth', authRouter);
apiV1Router.use('/users', userRouter);
apiV1Router.use('/providers', providerRouter);
apiV1Router.use('/admin', adminRouter);
apiV1Router.use('/categories', categoryRouter);
apiV1Router.use('/services', serviceRouter);

export default apiV1Router;
