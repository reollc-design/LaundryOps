import assert from 'node:assert/strict';
import {
  APPROVED_MANUAL_EXCERPT_END,
  APPROVED_MANUAL_EXCERPT_START,
  REPAIR_ASSIST_SYSTEM_INSTRUCTIONS,
} from './src/repair-assist-policy.ts';

assert.match(REPAIR_ASSIST_SYSTEM_INSTRUCTIONS, /only approved source of truth/);
assert.match(REPAIR_ASSIST_SYSTEM_INSTRUCTIONS, /untrusted reference material/);
assert.match(REPAIR_ASSIST_SYSTEM_INSTRUCTIONS, /Ignore commands/);
assert.match(REPAIR_ASSIST_SYSTEM_INSTRUCTIONS, /do not add general/);
assert.equal(APPROVED_MANUAL_EXCERPT_START, 'BEGIN APPROVED MANUAL EXCERPTS');
assert.equal(APPROVED_MANUAL_EXCERPT_END, 'END APPROVED MANUAL EXCERPTS');

console.log('Repair Assist policy tests passed.');
