import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../../src/services/passwordService';

describe('passwordService', () => {
  it('hashes a password to something other than the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('confirms a matching password against its hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(comparePassword('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects a non-matching password against a hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(comparePassword('wrong password', hash)).resolves.toBe(false);
  });
});
