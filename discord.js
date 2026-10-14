const API = 'https://discord.com/api/v10';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export function relayAPIBase(value) {
  if (!value?.trim()) return API;
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('L’adresse du relais doit être une URL HTTPS Cloudflare Worker.'); }
  const allowedHost = url.hostname === 'livebot.cataclyse.xyz' || /^[a-z0-9.-]+\.workers\.dev$/.test(url.hostname);
  if (url.protocol !== 'https:' || !allowedHost || url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Utilisez https://livebot.cataclyse.xyz ou l’origine HTTPS de votre Worker (*.workers.dev), sans chemin ni paramètres.');
  }
  return url.origin + '/api/discord';
}

export class DiscordClient {
  #token;
  #fetch;
  #queue = Promise.resolve();
  #cooldown = 0;
  #stopped = false;
  #base;
  constructor(token, fetcher = globalThis.fetch, relayURL = '') {
    this.#token = token.trim().replace(/^Bot\s+/i, '');
    this.#fetch = fetcher;
    this.#base = relayAPIBase(relayURL);
  }
  async prepare(pageURL = globalThis.location?.href) {
    if (!pageURL || this.#base !== API) return;
    const page = new URL(pageURL);
    if (page.protocol === 'file:') throw new Error('Lancez npm start puis ouvrez http://127.0.0.1:8080, plutôt que le fichier index.html.');
    if (!['localhost', '127.0.0.1', '[::1]'].includes(page.hostname)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const r = await this.#fetch(new URL('/livebot-health', page).href, { signal: controller.signal, credentials: 'omit', redirect: 'error' });
      if (r.ok && (await r.json()).relay === 'livebot-local-v1') this.#base = new URL('/api/discord', page).href;
    } catch { /* A different preview server keeps direct API access. */ }
    finally { clearTimeout(timer); }
  }
  stop() { this.#stopped = true; this.#token = ''; }
  request(path, options = {}) {
    const task = this.#queue.then(() => this.#request(path, options));
    this.#queue = task.catch(() => {});
    return task;
  }
  async #request(path, options) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (this.#stopped) throw new Error('Session déconnectée.');
      await wait(Math.max(0, this.#cooldown - Date.now()));
      if (this.#stopped) throw new Error('Session déconnectée.');
      let response;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        response = await this.#fetch(this.#base + path, {
          method: options.method || 'GET',
          headers: { Authorization: `Bot ${this.#token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
          ...(options.body ? { body: JSON.stringify(options.body) } : {}),
          signal: controller.signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer'
        });
      } catch {
        if (controller.signal.aborted) throw new Error('La connexion n’a pas répondu sous 20 secondes. Réessayez.');
        throw new Error(this.#base === API ? 'L’accès direct à Discord a échoué (réseau ou blocage navigateur). En local, utilisez npm start ; sur GitHub Pages, configurez votre relais dans « Connexion avancée ».' : 'Le relais est injoignable ou refuse cette origine. Vérifiez son adresse et ALLOWED_ORIGINS ; consultez la console réseau du navigateur.');
      } finally { clearTimeout(timer); }
      const data = response.status === 204 ? null : await response.json().catch(() => ({}));
      if (response.status === 429) {
        const seconds = Number(data.retry_after);
        this.#cooldown = Date.now() + (Number.isFinite(seconds) ? Math.max(1, seconds) * 1000 : 5000);
        if (this.#cooldown - Date.now() > 30000) throw new Error('Limite Discord atteinte. Patientez avant de réessayer.');
        continue;
      }
      if (response.headers.get('x-ratelimit-remaining') === '0') {
        const seconds = Number(response.headers.get('x-ratelimit-reset-after'));
        if (Number.isFinite(seconds)) this.#cooldown = Date.now() + Math.max(0, seconds) * 1000;
      }
      if (!response.ok) {
        if ([502, 504].includes(response.status)) throw new Error('Le relais ne parvient pas à joindre Discord. Vérifiez sa connexion et réessayez.');
        if (response.status === 503) throw new Error('Configurez ALLOWED_ORIGINS sur le Worker avant de vous connecter.');
        if (response.status === 401) throw new Error('Token invalide ou révoqué. Utilisez le token d’un bot, pas celui d’un compte utilisateur.');
        if (response.status === 403) throw new Error('Le bot n’a pas les permissions nécessaires dans ce salon (voir le salon, lire l’historique ou envoyer des messages).');
        if (response.status === 404) throw new Error('Ce serveur, salon ou message n’est plus accessible au bot.');
        throw new Error(`Discord a refusé la requête (${response.status}). Réessayez plus tard.`);
      }
      return data;
    }
    throw new Error('Trop de requêtes. Patientez avant de réessayer.');
  }
  me() { return this.request('/users/@me'); }
  async guilds() {
    const result = [];
    let after = '';
    for (;;) {
      const page = await this.request(`/users/@me/guilds?limit=200${after ? `&after=${after}` : ''}`);
      result.push(...page);
      if (page.length < 200) return result;
      after = page.at(-1).id;
    }
  }
  channels(id) { return this.request(`/guilds/${id}/channels`); }
  messages(id, before) { return this.request(`/channels/${id}/messages?limit=50${before ? `&before=${before}` : ''}`); }
  send(id, content) { return this.request(`/channels/${id}/messages`, { method: 'POST', body: { content, allowed_mentions: { parse: [] } } }); }
  delete(id, message) { return this.request(`/channels/${id}/messages/${message}`, { method: 'DELETE' }); }
  gateway() { return this.request('/gateway/bot'); }
}

export class Gateway {
  #token;
  #socket;
  #heartbeat;
  #reconnect;
  #sequence = null;
  #session = null;
  #resumeURL = null;
  #acked = true;
  #stopped = false;
  #attempt = 0;
  constructor({ token, url, contentIntent, onEvent, onStatus }) {
    this.#token = token.trim().replace(/^Bot\s+/i, '');
    this.url = url;
    this.intents = 1 | 512 | (contentIntent ? 32768 : 0);
    this.onEvent = onEvent;
    this.onStatus = onStatus;
  }
  start() {
    if (this.#stopped) return;
    clearTimeout(this.#reconnect);
    this.onStatus('connecting');
    const endpoint = new URL(this.#resumeURL || this.url);
    if (endpoint.protocol !== 'wss:' || !/^gateway(?:-[a-z0-9-]+)?\.discord\.gg$/.test(endpoint.hostname)) {
      this.onStatus('error', 'Adresse Gateway Discord non reconnue.');
      return;
    }
    endpoint.search = 'v=10&encoding=json';
    const ws = this.#socket = new WebSocket(endpoint.href);
    const send = (op, d) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op, d })); };
    const heartbeat = () => {
      if (!this.#acked) { ws.close(4000, 'Heartbeat timeout'); return; }
      this.#acked = false;
      send(1, this.#sequence);
    };
    ws.onmessage = ({ data }) => {
      if (this.#stopped || ws !== this.#socket) return;
      let packet;
      try { packet = JSON.parse(data); } catch { return; }
      if (packet.s != null) this.#sequence = packet.s;
      if (packet.op === 10) {
        this.#acked = true;
        this.#heartbeat = setTimeout(function beat() {
          heartbeat();
          if (ws.readyState === WebSocket.OPEN) this.#heartbeat = setTimeout(beat.bind(this), packet.d.heartbeat_interval);
        }.bind(this), packet.d.heartbeat_interval * Math.random());
        if (this.#session) send(6, { token: this.#token, session_id: this.#session, seq: this.#sequence });
        else send(2, { token: this.#token, intents: this.intents, properties: { os: 'browser', browser: 'LiveBot', device: 'LiveBot' }, presence: { status: 'online', activities: [], afk: false, since: null } });
      } else if (packet.op === 11) this.#acked = true;
      else if (packet.op === 1) send(1, this.#sequence);
      else if (packet.op === 7) ws.close(4000, 'Reconnect');
      else if (packet.op === 9) {
        if (!packet.d) { this.#session = null; this.#sequence = null; this.#resumeURL = null; }
        ws.close(4000, 'Invalid session');
      } else if (packet.op === 0) {
        if (packet.t === 'READY') { this.#session = packet.d.session_id; this.#resumeURL = packet.d.resume_gateway_url; }
        if (packet.t === 'READY' || packet.t === 'RESUMED') { this.#attempt = 0; this.onStatus('online'); }
        this.onEvent(packet.t, packet.d);
      }
    };
    ws.onerror = () => {};
    ws.onclose = ({ code }) => {
      clearTimeout(this.#heartbeat);
      if (this.#stopped || ws !== this.#socket) return;
      if ([4004, 4010, 4011, 4012, 4013, 4014].includes(code)) {
        const message = code === 4014 ? 'Activez « Message Content Intent » dans le Developer Portal, ou reconnectez-vous en décochant la lecture du contenu.' : code === 4011 ? 'Ce bot nécessite plusieurs shards ; cette version prend en charge les bots avec un seul shard.' : `Connexion temps réel refusée par Discord (${code}). Vérifiez le token et la configuration du bot.`;
        this.onStatus('error', message);
        return;
      }
      if ([4007, 4009].includes(code)) { this.#session = null; this.#sequence = null; this.#resumeURL = null; }
      this.onStatus('reconnecting');
      this.#reconnect = setTimeout(() => this.start(), Math.min(30000, 5000 * 2 ** this.#attempt++) + Math.random() * 1000);
    };
  }
  stop() {
    this.#stopped = true;
    this.#token = '';
    clearTimeout(this.#heartbeat);
    clearTimeout(this.#reconnect);
    this.#socket?.close(1000, 'Logout');
    this.#socket = null;
  }
}
