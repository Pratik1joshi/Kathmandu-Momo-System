import assert from 'node:assert/strict';
import { safeApiErrorPayload } from '../lib/api-error-policy.js';

const internal = Object.assign(
  new Error('postgres constraint failed at C:\\private\\app\\secret.js'),
  { status: 500 }
);
internal.stack = 'Error: SELECT password_hash FROM users\n at C:\\private\\app\\secret.js:1';

const production = safeApiErrorPayload(internal, 'Request failed.', 'production');
const serialized = JSON.stringify(production.payload);
assert.equal(production.status, 500);
assert.deepEqual(production.payload, { error: 'Request failed.' });
for (const forbidden of ['debugMessage', 'debugStack', 'postgres', 'SELECT', 'password_hash', 'C:\\\\private']) {
  assert.equal(serialized.includes(forbidden), false, `production response leaked ${forbidden}`);
}

const development = safeApiErrorPayload(internal, 'Request failed.', 'development');
assert.equal(development.payload.debugMessage, internal.message);
assert.equal(development.payload.debugStack, internal.stack);

const clientError = Object.assign(new Error('A reason is required.'), { status: 400 });
assert.deepEqual(
  safeApiErrorPayload(clientError, 'Request failed.', 'production'),
  { status: 400, payload: { error: 'A reason is required.' } }
);

console.log('API error response policy: PASS');

