import { UserRole } from '../../../generated/prisma/enums.js';

export type RegisterInput =
  | {
      name: string;
      email: string;
      password: string;
      phone: string;
      role: typeof UserRole.CUSTOMER;
    }
  | {
      name: string;
      email: string;
      password: string;
      phone: string;
      role: typeof UserRole.PROVIDER;
      businessName: string;
      city: string;
      address: string;
      bio?: string;
    };

export type LoginInput = {
  email: string;
  password: string;
};

export type RefreshTokenInput = {
  refreshToken: string;
};
