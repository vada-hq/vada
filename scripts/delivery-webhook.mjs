// Disposable, memory-only experiment. Not a production webhook worker.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function dummyNumber(now = new Date()) {
  const step = 3 * 60 * 60 * 1000;
  return new Date((Math.floor(now.getTime() / step) + 1) * step).toISOString().replace('.000Z', 'Z');
}

export function createReceiver({ path, trackingNumber, lookup, log = console.log }) {
  let busy = false;
  const server = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== path) { res.writeHead(404).end(); return; }
    let size = 0;
    const chunks = [];
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 4096) { res.writeHead(413).end(); return; }
        chunks.push(chunk);
      }
      const payload = JSON.parse(Buffer.concat(chunks).toString());
      if (payload?.carrierId !== 'dev.track.dummy' || payload?.trackingNumber !== trackingNumber) {
        res.writeHead(400).end(); return;
      }
    } catch { if (!res.headersSent) res.writeHead(400).end(); return; }
    if (busy) { res.writeHead(503).end(); return; }
    busy = true;
    res.writeHead(202).end();
    log({ event: 'CALLBACK_RECEIVED', at: new Date().toISOString() });
    try {
      const result = await lookup();
      log({ event: 'LOOKUP_OK', time: result.time, status: result.status.code });
    } catch { log({ event: 'LOOKUP_FAILED', retry: 'Use console test trigger to retry' }); }
    finally { busy = false; }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  return server;
}

async function main() {
  let id = process.env.DELIVERY_TEST_CLIENT_ID;
  let secret = process.env.DELIVERY_TEST_CLIENT_SECRET;
  const origin = new URL(process.env.DELIVERY_TEST_PUBLIC_URL);
  delete process.env.DELIVERY_TEST_CLIENT_ID;
  delete process.env.DELIVERY_TEST_CLIENT_SECRET;
  if (!id || !secret || origin.protocol !== 'https:' || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash) throw new Error('INVALID_CONFIGURATION');
  const authorization = `TRACKQL-API-KEY ${id}:${secret}`;
  id = secret = null;
  const graphql = async (query, variables) => {
    const response = await fetch('https://apis.tracker.delivery/graphql', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error('HTTP_FAILURE');
    const body = await response.json();
    if (body.errors?.length || !body.data) throw new Error('GRAPHQL_FAILURE');
    return body.data;
  };
  const trackingNumber = dummyNumber();
  const path = `/hook/${randomBytes(32).toString('hex')}`;
  const lookup = async () => {
    const data = await graphql(`query($carrierId: ID!, $trackingNumber: String!) {
      track(carrierId: $carrierId, trackingNumber: $trackingNumber) { lastEvent { time status { code } } }
    }`, { carrierId: 'dev.track.dummy', trackingNumber });
    if (!data.track?.lastEvent?.status?.code) throw new Error('NO_EVENT');
    return data.track.lastEvent;
  };
  const server = createReceiver({ path, trackingNumber, lookup });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(8898, '127.0.0.1', resolve); });
  console.log('LOCAL_RECEIVER_READY port=8898');
  const registration = `mutation($input: RegisterTrackWebhookInput!) { registerTrackWebhook(input: $input) }`;
  const input = { carrierId: 'dev.track.dummy', trackingNumber, callbackUrl: new URL(path, origin).href,
    expirationTime: new Date(Date.now() + 30 * 60 * 1000).toISOString() };
  const shutdown = async () => {
    try {
      const result = await graphql(registration, { input: { ...input, expirationTime: new Date().toISOString() } });
      console.log(result.registerTrackWebhook === true ? 'UNREGISTERED' : 'UNREGISTER_NOT_CONFIRMED');
    } catch { console.log('UNREGISTER_FAILED: registration expires automatically within 30 minutes.'); }
    server.closeAllConnections(); server.close();
  };
  try {
    const first = await lookup();
    console.log({ event: 'INITIAL_LOOKUP_OK', time: first.time, status: first.status.code });
    const result = await graphql(registration, { input });
    if (result.registerTrackWebhook !== true) throw new Error('REGISTRATION_FAILURE');
    console.log('REGISTERED: use Delivery Tracker console > Webhook > Callback Call Test Trigger.');
    console.log('Dummy number:', trackingNumber);
    console.log('Expires in 30 minutes. Keep this window and the tunnel open. Ctrl+C stops the experiment.');
  } catch {
    console.log('SETUP_FAILED: verify credentials, public URL and tunnel. No raw error or secrets printed.');
    await shutdown(); process.exitCode = 1; return;
  }
  const timer = setTimeout(() => { void stop(); }, 30 * 60 * 1000);
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true; clearTimeout(timer); await shutdown();
  }
  process.once('SIGINT', () => { void stop(); });
  process.once('SIGTERM', () => { void stop(); });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('START_FAILED: check configuration or port 8898.'); process.exitCode = 1; });
}
