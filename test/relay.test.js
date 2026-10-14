import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRelay } from '../relay/worker.js';
import { DiscordClient, relayAPIBase } from '../discord.js';
import { createLocalServer } from '../scripts/serve.js';
const origin = 'https://cataclyse.github.io';
const request = (path = '/users/@me', options = {}) => new Request('https://livebot.example.workers.dev/api/discord' + path, { ...options, headers: { Origin: origin, Authorization: 'Bot fake-token', ...options.headers } });

test('relay answers preflight without forwarding a token', async () => {
  const r = await handleRelay(request('/channels/123/messages', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'POST' } }), [origin], () => { throw new Error('Unexpected upstream'); });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), origin);
  assert.match(r.headers.get('Access-Control-Allow-Headers'), /Authorization/);
});
test('relay refuses untrusted origins, arbitrary paths and user authorization', async () => {
  for (const [req, status] of [[request('/users/@me', { headers: { Origin: 'https://evil.example' } }), 403], [request('/../../webhooks/123'), 404], [request('/users/@me', { headers: { Authorization: 'Bearer fake-token' } }), 401]]) {
    const r = await handleRelay(req, [origin], () => { throw new Error('Unexpected upstream'); });
    assert.equal(r.status, status);
  }
});
test('relay forwards only to Discord and preserves rate limits and authorization errors', async () => {
  let call;
  const r = await handleRelay(request('/users/@me'), [origin], async (url, options) => { call = { url, options }; return new Response('{"message":"401: Unauthorized"}', { status: 401, headers: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset-After': '2' } }); });
  assert.equal(call.url, 'https://discord.com/api/v10/users/@me');
  assert.equal(call.options.headers.Authorization, 'Bot fake-token');
  assert.equal(call.options.redirect, 'error');
  assert.equal(r.status, 401);
  assert.equal(r.headers.get('X-RateLimit-Reset-After'), '2');
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
});
test('relay validates messages and disables all automatic mentions', async () => {
  let body;
  const r = await handleRelay(request('/channels/123/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: '@everyone hello', allowed_mentions: { parse: ['everyone'] } }) }), [origin], async (url, options) => { body = JSON.parse(options.body); return new Response('{"id":"1"}'); });
  assert.equal(r.status, 200);
  assert.deepEqual(body, { content: '@everyone hello', allowed_mentions: { parse: [] } });
  const invalid = await handleRelay(request('/channels/123/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'x'.repeat(2001) }) }), [origin], () => { throw new Error('Unexpected upstream'); });
  assert.equal(invalid.status, 400);
});
test('relay never returns upstream exception text containing credentials', async () => {
  const r = await handleRelay(request(), [origin], () => { throw new Error('fake-token'); });
  assert.equal(r.status, 502);
  assert.doesNotMatch(await r.text(), /fake-token/);
});
test('client validates relay URLs and uses the selected endpoint', async () => {
  assert.equal(relayAPIBase('https://livebot.cataclyse.xyz'), 'https://livebot.cataclyse.xyz/api/discord');
  for (const url of ['http://livebot.example.workers.dev', 'https://evil.example', 'https://livebot.example.workers.dev/path', 'https://user:password@livebot.example.workers.dev']) assert.throws(() => relayAPIBase(url));
  let destination;
  const client = new DiscordClient('fake', async url => { destination = url; return new Response('{}'); }, 'https://livebot.example.workers.dev');
  await client.me();
  assert.equal(destination, 'https://livebot.example.workers.dev/api/discord/users/@me');
});
test('relay root identifies the service without exposing credentials or origins', async () => {
  const r = await handleRelay(new Request('https://livebot.cataclyse.xyz/'), [origin], () => { throw new Error('Unexpected upstream'); });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { service: 'LiveBot Discord relay', configured: true });
});
test('local server activates the relay and serves all frontend modules', async () => {
  const server = createLocalServer(async () => new Response('{"id":"123","bot":true}'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const local = `http://127.0.0.1:${server.address().port}`;
  try {
    const client = new DiscordClient('fake');
    await client.prepare(local);
    assert.deepEqual(await client.me(), { id: '123', bot: true });
    for (const path of ['/', '/config.js']) { const response = await fetch(local + path); assert.equal(response.status, 200); await response.text(); }
    const blocked = await fetch(local + '/api/discord/users/@me', { headers: { Origin: 'https://evil.example', Authorization: 'Bot fake' } });
    assert.equal(blocked.status, 403); await blocked.text();
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
