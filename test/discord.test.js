import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DiscordClient, Gateway, normalizeBotToken, probeConnection } from '../discord.js';

test('fetch keeps its global receiver for requests, probes and local detection', async () => {
  const calls = [];
  function browserFetch(url, options) {
    assert.equal(this, globalThis, 'Native Window.fetch must not receive DiscordClient as this');
    calls.push(url);
    if (url.endsWith('/livebot-health')) return Promise.resolve(new Response('{"relay":"livebot-local-v1"}'));
    return Promise.resolve(new Response('{}', { status: options.headers ? 200 : 401 }));
  }
  const client = new DiscordClient('fake-token', browserFetch);
  await client.prepare('http://127.0.0.1:8080');
  await client.me();
  await client.probe();
  assert.deepEqual(calls, ['http://127.0.0.1:8080/livebot-health', 'http://127.0.0.1:8080/api/discord/users/@me', 'http://127.0.0.1:8080/api/discord/users/@me']);
  await probeConnection('https://livebot.cataclyse.xyz', browserFetch);
});

test('invalid header characters are rejected before any network request', () => {
  for (const token of ['fake\u200btoken', 'fake…token', '"fake-token"', 'fake token', '']) {
    assert.throws(() => new DiscordClient(token, () => { throw new Error('Unexpected network'); }), /caractères invalides/);
  }
  assert.equal(normalizeBotToken(' Bot fake-token '), 'fake-token');
});

test('connection diagnostics do not send any token or authorization header', async () => {
  let call;
  const result = await probeConnection('https://livebot.cataclyse.xyz', async (url, options) => { call = { url, options }; return new Response('{}', { status: 401 }); });
  assert.equal(call.url, 'https://livebot.cataclyse.xyz/api/discord/users/@me');
  assert.equal(call.options.headers, undefined);
  assert.deepEqual(result, { endpoint: 'https://livebot.cataclyse.xyz', direct: false });
});

test('requests authenticate as a bot and suppress automatic mentions', async () => {
  const calls = [];
  const client = new DiscordClient(' Bot fake-token ', async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ id: 'message' }), { status: 200 });
  });
  await client.send('123', '@everyone hello');
  assert.equal(calls[0].url, 'https://discord.com/api/v10/channels/123/messages');
  assert.equal(calls[0].options.headers.Authorization, 'Bot fake-token');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.redirect, 'error');
  assert.deepEqual(JSON.parse(calls[0].options.body), { content: '@everyone hello', allowed_mentions: { parse: [] } });
});

test('unauthorized tokens and missing permissions produce actionable errors', async () => {
  for (const [status, pattern] of [[401, /Token invalide/], [403, /permissions nécessaires/]]) {
    const client = new DiscordClient('fake', async () => new Response('{}', { status }));
    await assert.rejects(client.me(), pattern);
  }
});

test('logout rejects queued requests without leaking the token', async () => {
  let release, count = 0;
  const client = new DiscordClient('fake', async () => {
    count++;
    await new Promise(resolve => { release = resolve; });
    return new Response('{}');
  });
  const first = client.me();
  const second = client.me();
  const rejected = assert.rejects(second, /Session déconnectée/);
  await new Promise(resolve => setTimeout(resolve, 10));
  client.stop(); release(); await first; await rejected;
  assert.equal(count, 1);
});

test('long rate limits stop rather than flooding Discord', async () => {
  let calls = 0;
  const client = new DiscordClient('fake', async () => { calls++; return new Response(JSON.stringify({ retry_after: 60 }), { status: 429 }); });
  await assert.rejects(client.me(), /Limite Discord/);
  assert.equal(calls, 1);
});

test('guild listing loads additional pages', async () => {
  const urls = [];
  const client = new DiscordClient('fake', async url => {
    urls.push(url);
    return new Response(JSON.stringify(urls.length === 1 ? Array.from({ length: 200 }, (_, i) => ({ id: String(i + 1) })) : [{ id: '201' }]));
  });
  assert.equal((await client.guilds()).length, 201);
  assert.match(urls[1], /after=200$/);
});

test('deleting a message accepts Discord’s empty 204 response', async () => {
  const client = new DiscordClient('fake', async () => new Response(null, { status: 204 }));
  assert.equal(await client.delete('123', '456'), null);
});

test('gateway identifies, records READY, resumes and stops cleanly', async () => {
  const Original = globalThis.WebSocket;
  const sockets = [];
  class Socket {
    static OPEN = 1;
    readyState = 1;
    sent = [];
    constructor(url) { this.url = url; sockets.push(this); }
    send(data) { this.sent.push(JSON.parse(data)); }
    close(code) { this.readyState = 3; this.onclose?.({ code }); }
    packet(data) { this.onmessage({ data: JSON.stringify(data) }); }
  }
  globalThis.WebSocket = Socket;
  const statuses = [], events = [];
  const gateway = new Gateway({ token: 'fake', url: 'wss://gateway.discord.gg', contentIntent: true, onEvent: (...args) => events.push(args), onStatus: status => statuses.push(status) });
  try {
    gateway.start();
    const first = sockets[0];
    first.packet({ op: 10, d: { heartbeat_interval: 45000 } });
    assert.equal(first.sent[0].op, 2);
    assert.equal(first.sent[0].d.intents, 33281);
    first.packet({ op: 0, t: 'READY', s: 42, d: { session_id: 'session', resume_gateway_url: 'wss://gateway-us-east1-b.discord.gg' } });
    first.close(4000);
    gateway.start();
    const second = sockets[1];
    assert.match(second.url, /^wss:\/\/gateway-us-east1-b\.discord\.gg/);
    second.packet({ op: 10, d: { heartbeat_interval: 45000 } });
    assert.deepEqual(second.sent[0], { op: 6, d: { token: 'fake', session_id: 'session', seq: 42 } });
    assert.ok(statuses.includes('online'));
    assert.equal(events[0][0], 'READY');
  } finally { gateway.stop(); globalThis.WebSocket = Original; }
});

test('gateway stops reconnecting when privileged intent is refused', () => {
  const Original = globalThis.WebSocket;
  let socket;
  globalThis.WebSocket = class {
    constructor() { socket = this; }
    close() {}
  };
  let error;
  const gateway = new Gateway({ token: 'fake', url: 'wss://gateway.discord.gg', contentIntent: true, onEvent() {}, onStatus(status, detail) { if (status === 'error') error = detail; } });
  try { gateway.start(); socket.onclose({ code: 4014 }); assert.match(error, /Message Content Intent/); }
  finally { gateway.stop(); globalThis.WebSocket = Original; }
});
