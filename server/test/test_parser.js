import test from 'node:test';
import assert from 'node:assert';
import { parseCapture } from '../src/parser.js';

test('Capture Parser - parses relative and explicit dates', () => {
  // 1. "Call the dentist tomorrow at 10am"
  const refDate = new Date('2026-10-31T12:00:00Z');
  const res1 = parseCapture('Call the dentist tomorrow at 10am', 'Asia/Kolkata', refDate);
  assert.strictEqual(res1.detectedType, 'TASK');
  assert.strictEqual(res1.suggestedTitle, 'Call the dentist');
  assert.ok(res1.suggestedDueAt);
  const d1 = new Date(res1.suggestedDueAt);
  assert.strictEqual(d1.getHours(), 10);
  assert.strictEqual(res1.parseStatus, 'PROCESSED');

  // 2. "Idea: build a tool that turns voice notes into tasks"
  const res2 = parseCapture('Idea: build a tool that turns voice notes into tasks', 'Asia/Kolkata', refDate);
  assert.strictEqual(res2.detectedType, 'NOTE');
  assert.strictEqual(res2.suggestedTitle, 'build a tool that turns voice notes into tasks');
  assert.strictEqual(res2.suggestedDueAt, null);

  // 3. Ambiguous date without year: "Finish project report by November 5"
  const res3 = parseCapture('Finish project report by November 5', 'Asia/Kolkata', refDate);
  assert.strictEqual(res3.detectedType, 'TASK');
  assert.strictEqual(res3.suggestedTitle, 'Finish project report');
  assert.strictEqual(res3.isAmbiguous, true);
  assert.strictEqual(res3.parseStatus, 'NEEDS_REVIEW');

  // 4. Raw text without date
  const res4 = parseCapture('Buy groceries and coffee beans', 'Asia/Kolkata', refDate);
  assert.strictEqual(res4.detectedType, 'TASK');
  assert.strictEqual(res4.suggestedTitle, 'Buy groceries and coffee beans');
  assert.strictEqual(res4.suggestedDueAt, null);
  assert.strictEqual(res4.parseStatus, 'PROCESSED');
});
