import app from './app.js';
import config from './config/index.js';
import prisma from './lib/prisma.js';

const server = app.listen(config.port, () => {
  console.info(`Servexa API is listening on port ${config.port} (${config.env}).`);
});

const shutdown = (): void => {
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};


//--
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
