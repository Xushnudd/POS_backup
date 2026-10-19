import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NavigationGuards } from '@/lib/navigation-guards';
test('Independent editors share one admission decision and clean teardown removes stale blockers', () => {
  const guards = new NavigationGuards(), a = Symbol(), b = Symbol();
  guards.set(a, { dirty: true, saving: false, warning: 'Discard?' });
  guards.set(b, { dirty: true, saving: false, warning: 'Discard?' });
  const prompts: string[] = [];
  assert.equal(guards.admit(warning => { prompts.push(warning); return false; }), false);
  assert.deepEqual(prompts, ['Discard?']);
  assert.equal(guards.admit(() => true), true);
  assert.equal(guards.active, true); // Admission never discards another editor.
  guards.delete(a); guards.delete(b);
  assert.equal(guards.active, false);
  assert.equal(guards.admit(() => { throw new Error('Clean state must not prompt'); }), true);
});
test('Saving blocks admission without a misleading discard prompt; each warning is preserved once', () => {
  const guards = new NavigationGuards(), a = Symbol(), b = Symbol();
  guards.set(a, { dirty: false, saving: true, warning: 'Busy' });
  guards.set(b, { dirty: true, saving: false, warning: 'Unknown result' });
  assert.equal(guards.admit(() => { throw new Error('Cannot approve leaving a busy operation'); }), false);
  guards.set(a, { dirty: true, saving: false, warning: 'Discard' });
  assert.equal(guards.admit(warning => { assert.equal(warning, 'Discard\nUnknown result'); return true; }), true);
  guards.set(a, { dirty: false, saving: false, warning: 'Discard' });
  guards.set(b, { dirty: false, saving: false, warning: 'Unknown result' });
  assert.equal(guards.active, false);
});
