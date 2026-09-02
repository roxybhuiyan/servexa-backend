import 'dotenv/config';

const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
  },
} as const;

export default config;
