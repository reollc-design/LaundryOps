import assert from 'node:assert/strict';
import { isInvalidOrganizationState } from './organizationRecovery.ts';

assert.equal(isInvalidOrganizationState({ loading: true, organizationExists: false, errorCode: null }), false);
assert.equal(isInvalidOrganizationState({ loading: false, organizationExists: null, errorCode: null }), false);
assert.equal(isInvalidOrganizationState({ loading: false, organizationExists: false, errorCode: null }), true);
assert.equal(isInvalidOrganizationState({ loading: false, organizationExists: true, errorCode: 'permission-denied' }), true);
assert.equal(isInvalidOrganizationState({ loading: false, organizationExists: true, errorCode: 'not-found' }), true);
assert.equal(isInvalidOrganizationState({ loading: false, organizationExists: true, errorCode: 'unavailable' }), false);

console.log('Organization recovery tests passed.');
