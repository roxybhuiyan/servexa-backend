import bcrypt from 'bcryptjs';

import config from '../config/index.js';

const saltRounds =
  Number.isInteger(config.bcryptSaltRounds) && config.bcryptSaltRounds >= 10
    ? config.bcryptSaltRounds
    : 12;

export const hashPassword = async (password: string): Promise<string> =>
  bcrypt.hash(password, saltRounds);

export const comparePassword = async (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);
