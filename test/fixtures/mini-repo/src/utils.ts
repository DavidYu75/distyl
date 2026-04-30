// utils.ts — shared utilities
import * as crypto from 'crypto';

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function generateToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}
