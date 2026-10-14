// No Discord token is configured on the server. Each request authenticates with
// the visitor's bot token. Never log request headers or bodies.
const routes = [
  ['GET', /^\/users\/@me$/], ['GET', /^\/users\/@me\/guilds$/], ['GET', /^\/gateway\/bot$/],
  ['GET', /^\/users\/\d+$/], ['GET', /^\/guilds\/\d+\/members\/\d+$/], ['GET', /^\/guilds\/\d+\/roles$/],
  ['POST', /^\/users\/@me\/channels$/], ['GET', /^\/channels\/\d+$/], ['PATCH', /^\/channels\/\d+$/], ['DELETE', /^\/channels\/\d+$/],
  ['POST', /^\/guilds\/\d+\/channels$/], ['PATCH', /^\/channels\/\d+\/messages\/\d+$/],
  ['GET', /^\/guilds\/\d+\/channels$/], ['GET', /^\/channels\/\d+\/messages$/],
  ['POST', /^\/channels\/\d+\/messages$/], ['DELETE', /^\/channels\/\d+\/messages\/\d+$/]
];

export async function handleRelay(request, allowedOrigins, fetcher = globalThis.fetch) {
  const origin = request.headers.get('Origin');
  const cors = new Headers({ 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' });
  const reply = (status, message) => new Response(JSON.stringify({ message }), { status, headers: new Headers([...cors, ['Content-Type', 'application/json']]) });
  if (new URL(request.url).pathname === '/' && request.method === 'GET') {
    return new Response(JSON.stringify({ service: 'LiveBot Discord relay', configured: allowedOrigins.length > 0 }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  if (!allowedOrigins.length) return reply(503, 'Relay not configured');
  if (!origin || !allowedOrigins.includes(origin)) return reply(403, 'Origin not allowed');
  cors.set('Access-Control-Allow-Origin', origin);
  cors.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  cors.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  cors.set('Access-Control-Expose-Headers', 'X-RateLimit-Remaining, X-RateLimit-Reset-After, Retry-After');
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/discord/')) return reply(404, 'Unknown route');
  const path = url.pathname.slice('/api/discord'.length);
  const method = request.method === 'OPTIONS' ? request.headers.get('Access-Control-Request-Method') : request.method;
  if (!routes.some(([verb, pattern]) => verb === method && pattern.test(path))) return reply(404, 'Unsupported Discord route');
  for (const [key, value] of url.searchParams) {
    if (!['limit', 'before', 'after'].includes(key) || !/^\d{1,20}$/.test(value)) return reply(400, 'Invalid query');
    if (key === 'limit' && (Number(value) < 1 || Number(value) > (path.endsWith('/guilds') ? 200 : 100))) return reply(400, 'Invalid limit');
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const authorization = request.headers.get('Authorization') || '';
  if (!/^Bot [A-Za-z0-9._-]{1,512}$/.test(authorization)) return reply(401, 'Bot authorization required');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    let body;
    if (['POST', 'PATCH'].includes(request.method)) {
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) return reply(415, 'JSON required');
      const reader = request.body?.getReader();
      if (!reader) return reply(400, 'Missing body');
      const chunks = []; let length = 0;
      for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 16384) { await reader.cancel(); return reply(413, 'Message too large'); } chunks.push(value); }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const data = JSON.parse(new TextDecoder().decode(bytes));
      if(!data||typeof data!=='object'||Array.isArray(data))return reply(400,'Invalid JSON object');
      if (path === '/users/@me/channels') {
        if (typeof data.recipient_id !== 'string' || !/^\d{1,20}$/.test(data.recipient_id)) return reply(400, 'Invalid recipient');
        body = JSON.stringify({ recipient_id: data.recipient_id });
      } else if (/^\/channels\/\d+\/messages(?:\/\d+)?$/.test(path)) {
        if (typeof data.content !== 'string' || (request.method === 'POST' && !data.content.trim()) || data.content.length > 2000) return reply(400, 'Invalid message content');
        const message = { content: data.content, allowed_mentions: { parse: [], replied_user: false } };
        if (request.method === 'POST' && data.message_reference) {
          if (!/^\d{1,20}$/.test(data.message_reference.message_id || '') || (data.message_reference.channel_id && data.message_reference.channel_id !== path.split('/')[2])) return reply(400, 'Invalid message reference');
          message.message_reference = { message_id: data.message_reference.message_id, channel_id: path.split('/')[2], fail_if_not_exists: false };
        }
        body = JSON.stringify(message);
      } else {
        const channel = {};
        if (data.name !== undefined) { if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 100) return reply(400, 'Invalid channel name'); channel.name = data.name.trim(); }
        if (data.topic !== undefined) { if (data.topic !== null && (typeof data.topic !== 'string' || data.topic.length > 1024)) return reply(400, 'Invalid topic'); channel.topic = data.topic; }
        if (request.method === 'POST') { if (!channel.name) return reply(400, 'Missing channel name'); channel.type = 0; }
        if (!Object.keys(channel).length) return reply(400, 'Empty channel update');
        body = JSON.stringify(channel);
      }
    }
    const upstream = await fetcher(`https://discord.com/api/v10${path}${url.search}`, {
      method: request.method, headers: { Authorization: authorization, 'User-Agent': 'DiscordBot (https://github.com/Cataclyse/LiveBot-Discord-Online, 1.0)', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body } : {}), redirect: 'manual', signal: controller.signal
    });
    if (upstream.status >= 300 && upstream.status < 400) return reply(502, 'Discord upstream redirect refused');
    for (const key of ['x-ratelimit-remaining', 'x-ratelimit-reset-after', 'retry-after']) { const value = upstream.headers.get(key); if (value !== null) cors.set(key, value); }
    cors.set('Content-Type', 'application/json');
    const content = upstream.status === 204 ? null : await upstream.text();
    return new Response(content, { status: upstream.status, headers: cors });
  } catch (cause) { return reply(cause instanceof SyntaxError ? 400 : controller.signal.aborted ? 504 : 502, cause instanceof SyntaxError ? 'Invalid JSON' : 'Discord upstream unavailable'); }
  finally { clearTimeout(timeout); }
}

export default {
  fetch(request, env) {
    return handleRelay(request, (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean));
  }
};
