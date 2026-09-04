import 'dotenv/config';

const env = process.env.NODE_ENV ?? 'development';

const parseCorsOrigins = (value: string | undefined): string[] => {
  const rawOrigins = value ?? (env === 'production' ? '' : 'http://localhost:3000');

  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      if (origin === '*') throw new Error('CORS_ORIGINS must not contain a wildcard origin');

      const url = new URL(origin);
      if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`Invalid CORS origin: ${origin}`);
      }

      return origin;
    });
};

const config = {
  env,
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: process.env.DATABASE_URL,
  cors: {
    origins: parseCorsOrigins(process.env.CORS_ORIGINS),
  },
  platformFeePercent: process.env.PLATFORM_FEE_PERCENT ?? '10',
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    currency: (process.env.STRIPE_CURRENCY ?? 'usd').toLowerCase(),
    appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5000',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 12),
} as const;

export default config;
