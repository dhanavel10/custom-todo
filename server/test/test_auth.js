import test from 'node:test';
import assert from 'node:assert';
import { validateStrongPassword, validateUsername, hashPassword, comparePassword } from '../src/auth.js';

test('Strong Password Validation', () => {
  // Too short
  assert.strictEqual(validateStrongPassword('Ab1!').valid, false);
  // Missing uppercase
  assert.strictEqual(validateStrongPassword('password123!').valid, false);
  // Missing lowercase
  assert.strictEqual(validateStrongPassword('PASSWORD123!').valid, false);
  // Missing number
  assert.strictEqual(validateStrongPassword('Password!@#').valid, false);
  // Missing special char
  assert.strictEqual(validateStrongPassword('Password123').valid, false);

  // Valid strong passwords
  assert.strictEqual(validateStrongPassword('StrongP@ss123').valid, true);
  assert.strictEqual(validateStrongPassword('MySecur3!Pass').valid, true);
});

test('Username Validation', () => {
  // Too short
  assert.strictEqual(validateUsername('ab').valid, false);
  // Invalid chars
  assert.strictEqual(validateUsername('user name').valid, false);
  assert.strictEqual(validateUsername('user@name').valid, false);

  // Valid usernames
  const res1 = validateUsername('dhanavel');
  assert.strictEqual(res1.valid, true);
  assert.strictEqual(res1.username, 'dhanavel');

  const res2 = validateUsername('Dev_User99');
  assert.strictEqual(res2.valid, true);
  assert.strictEqual(res2.username, 'dev_user99');
});

test('Password Hashing and Comparison', async () => {
  const plain = 'StrongPass123!';
  const hash = await hashPassword(plain);
  assert.notStrictEqual(hash, plain);
  assert.strictEqual(await comparePassword(plain, hash), true);
  assert.strictEqual(await comparePassword('WrongPass123!', hash), false);
});
