import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReceiver, dummyNumber } from './delivery-webhook.mjs';

test('dummy number uses next UTC three-hour boundary', () => {
  assert.equal(dummyNumber(new Date('2026-09-30T06:01:00Z')), '2026-09-30T09:00:00Z');
});

test('receiver rejects invalid callbacks and re-queries only the configured shipment', async t => {
  let calls = 0;
  let release;
  const logs = [];
  const server = createReceiver({ path: '/hook/private', trackingNumber: 'dummy',
    lookup: () => { calls++; return new Promise(resolve => { release = resolve; }); },
    log: value => logs.push(value) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(url + path, { method: 'POST', body });
  assert.equal((await post('/wrong', '{}')).status, 404);
  assert.equal((await post('/hook/private', '{')).status, 400);
  assert.equal((await post('/hook/private', 'x'.repeat(5000))).status, 413);
  assert.equal((await post('/hook/private', JSON.stringify({ carrierId: 'other', trackingNumber: 'dummy' }))).status, 400);
  assert.equal(calls, 0);
  const payload = JSON.stringify({ carrierId: 'dev.track.dummy', trackingNumber: 'dummy', status: 'FAKE' });
  assert.equal((await post('/hook/private', payload)).status, 202);
  assert.equal((await post('/hook/private', payload)).status, 503);
  assert.equal(calls, 1);
  release({ time: '2026-09-30T09:00:00Z', status: { code: 'DELIVERED' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(logs.at(-1).status, 'DELIVERED');
  assert.equal(JSON.stringify(logs).includes('FAKE'), false);
});
