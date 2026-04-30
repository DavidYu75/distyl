// auth.test.ts — write a test for validateToken
import { validateToken } from '../src/auth';

describe('validateToken', () => {
  it('returns false for invalid tokens', () => {
    expect(validateToken('bad')).toBe(false);
  });

  it('write a test that catches timing attacks', () => {
    // TODO: write a test for timing-safe comparison
  });
});
