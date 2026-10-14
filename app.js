import { DiscordClient, Gateway, probeConnection } from './discord.js';
import { config } from './config.js';
import { renderMarkdown } from './message-content.js';
import { renderAttachment, renderEmbed, clearMediaState } from './media.js';
import { icon } from './icons.js';

const $ = id => document.getElementById(id);
const colors = ['#5865f2', '#bc836b', '#4a9d83', '#ae70bd', '#be8e42', '#587ba4'];
const state = { demo: false, client: null, gateway: null, user: null, guilds: [], guild: null, channels: [], channel: null, cache: new Map(), revision: 0, sending: false, historyLoading: false, hasOlder: false, session: 0 };
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const name = user => user.global_name || user.username || 'Utilisateur';
function avatar(user, className = 'avatar') {
  const node = el('div', className, name(user).slice(0, 1).toUpperCase());
  const index = [...String(user.id)].reduce((sum, c) => sum + c.charCodeAt(0), 0) % colors.length;
  node.style.backgroundColor = colors[index];
  const img = el('img');
  img.src = /^\d+$/.test(user.id) && /^[a-zA-Z0-9_]+$/.test(user.avatar || '') ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=80` : `https://cdn.discordapp.com/embed/avatars/${/^\d+$/.test(user.id) ? Number((BigInt(user.id) >> 22n) % 6n) : index}.png`;
  img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.addEventListener('error', () => { node.textContent = name(user).slice(0, 1).toUpperCase(); }); node.replaceChildren(img);
  return node;
}
function notice(text = '', error = false) { $('app-notice').textContent = text; $('app-notice').hidden = !text; $('app-notice').classList.toggle('error', error); }
function error(message) { notice(message instanceof Error ? message.message : String(message), true); }
function setStatus(status, detail) {
  const labels = { online: 'En ligne', connecting: 'Connexion…', reconnecting: 'Reconnexion…', error: 'Temps réel indisponible', demo: 'Mode démo' };
  $('connection-status').textContent = labels[status] || status;
  $('settings-status').textContent = labels[status] || status;
  if (detail) error(detail);
  else if (status === 'online') notice('Connecté à Discord. Vous écrivez sous l’identité de votre bot.');
}
function demoData() {
  const users = [{ id: 'demo-bot', username: 'LiveBot', bot: true }, { id: 'max', username: 'Maxime' }, { id: 'lea', username: 'Léa' }, { id: 'alex', username: 'Alex' }];
  state.user = users[0];
  state.guilds = [{ id: 'demo-1', name: 'Le QG des créateurs' }, { id: 'demo-2', name: 'Bot Lab' }, { id: 'demo-3', name: 'La communauté' }];
  const contents = ['Bienvenue dans **#général**.\nCe salon permet de tester le client.', 'Le texte peut être **gras**, *italique*, __souligné__ ou ~~barré~~.', 'Et on peut combiner __**les styles**__ ou masquer ||un spoiler||.', '```javascript\nconst client = new DiscordClient(token);\nawait client.send(channelId, "Bonjour !");\n```', '> Une citation\n\nUn lien vers le [Developer Portal](https://discord.com/developers/applications) et du `code inline`.', '- Premier élément\n- Deuxième élément\n\n-# Texte secondaire', 'Les images et les pièces jointes s’affichent sous le message.'];
  const authors = [users[2], users[1], users[3], users[0], users[1], users[2], users[0]];
  const base = Date.now() - 28 * 60000;
  state.cache.set('demo-1-general', contents.map((content, i) => ({ id: `demo-msg-${i}`, channel_id: 'demo-1-general', content, author: authors[i], timestamp: new Date(base + i * 3 * 60000).toISOString() })));
  state.cache.get('demo-1-general').at(-1).attachments = [{ id: 'demo-image', url: new URL('./assets/discord/login-artwork.svg', location.href).href, content_type: 'image/svg+xml', filename: 'discord-login.svg', width: 1440, height: 900 }, { id: 'demo-spoiler', url: new URL('./assets/discord/login-artwork.svg', location.href).href, content_type: 'image/svg+xml', filename: 'SPOILER_apercu.svg', width: 1440, height: 900 }];
}
function demoChannels(guild) { return [{ id: `${guild.id}-category`, name: 'LA COMMUNAUTÉ', type: 4, position: 0 }, ...['général', 'présentations', 'projets', 'bot-commands', 'ressources'].map((n, i) => ({ id: `${guild.id}-${i === 0 ? 'general' : i}`, name: n, type: 0, position: i, parent_id: `${guild.id}-category`, topic: i === 0 ? 'Un endroit pour discuter, créer et partager.' : `Les conversations de #${n}.` }))]; }
function showApp() {
  $('login-view').hidden = true; $('app-view').hidden = false;
  $('user-avatar').replaceWith(Object.assign(avatar(state.user), { id: 'user-avatar' }));
  $('user-name').textContent = name(state.user);
  $('demo-badge').hidden = !state.demo;
  $('sidebar-mode').textContent = state.demo ? 'Espace de démonstration' : 'Connecté à Discord';
  $('composer-identity').textContent = `Vous écrivez en tant que ${name(state.user)}`;
  renderGuilds();
}
function renderGuilds() {
  const nodes = state.guilds.map(guild => {
    const button = el('button', 'server-button', guild.name.split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase());
    button.title = guild.name; button.setAttribute('aria-label', guild.name); button.classList.toggle('active', guild.id === state.guild?.id);
    if (/^\d+$/.test(guild.id) && /^[a-zA-Z0-9_]+$/.test(guild.icon || '')) { const img = el('img'); img.src = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=96`; img.alt = ''; button.replaceChildren(img); }
    button.addEventListener('click', () => selectGuild(guild));
    return button;
  });
  $('server-list').replaceChildren(...nodes);
}
async function selectGuild(guild) {
  const revision = ++state.revision;
  state.guild = guild; state.channel = null; state.channels = []; state.hasOlder = false; state.historyLoading = false;
  $('server-name').textContent = guild.name; $('channel-title').textContent = 'Choisissez un salon'; $('channel-topic').textContent = ''; $('message-input').disabled = true; $('message-input').value = ''; $('send-button').disabled = true; $('messages').replaceChildren(); $('member-list').replaceChildren(); $('member-count').textContent = '0'; $('load-older').hidden = true; $('welcome-title').textContent = guild.name; $('welcome-description').textContent = 'Sélectionnez un salon textuel pour discuter.';
  renderGuilds(); $('channel-list').replaceChildren(el('p', 'empty-state', 'Chargement des salons…'));
  try {
    const channels = state.demo ? demoChannels(guild) : await state.client.channels(guild.id);
    if (revision !== state.revision) return;
    state.channels = channels.sort((a, b) => a.position - b.position);
    renderChannels();
    const first = state.channels.find(c => [0, 5].includes(c.type));
    if (first) await selectChannel(first);
    else $('channel-list').replaceChildren(el('p', 'empty-state', 'Aucun salon textuel disponible pour ce bot.'));
  } catch (e) { if (revision === state.revision) { error(e); $('channel-list').replaceChildren(el('p', 'empty-state', 'Impossible de charger les salons. Utilisez ↻ pour réessayer.')); } }
}
function renderChannels() {
  const nodes = [];
  const addChannel = channel => {
    const button = el('button', 'channel-button'); button.append(el('span', 'hash', '#'), el('span', '', channel.name)); button.classList.toggle('active', state.channel?.id === channel.id); button.setAttribute('aria-current', state.channel?.id === channel.id ? 'page' : 'false'); button.addEventListener('click', () => selectChannel(channel)); nodes.push(button);
  };
  const textChannels = state.channels.filter(c => [0, 5].includes(c.type));
  textChannels.filter(c => !c.parent_id || !state.channels.some(p => p.id === c.parent_id && p.type === 4)).forEach(addChannel);
  state.channels.filter(c => c.type === 4).forEach(category => { const children = textChannels.filter(c => c.parent_id === category.id); if (children.length) { nodes.push(el('div', 'category-label', `⌄ ${category.name}`)); children.forEach(addChannel); } });
  $('channel-list').replaceChildren(...nodes);
}
async function selectChannel(channel) {
  const revision = ++state.revision;
  state.channel = channel; state.hasOlder = false; state.historyLoading = false;
  document.body.classList.remove('sidebar-open');
  $('channel-title').textContent = channel.name; $('channel-topic').textContent = channel.topic || '';
  $('welcome-title').textContent = `Bienvenue dans #${channel.name} !`;
  $('welcome-description').textContent = channel.topic || 'Le début de votre conversation dans ce salon.';
  $('message-input').placeholder = `Envoyer un message dans #${channel.name}`; $('message-input').value = ''; $('character-count').textContent = '0/2000'; $('message-input').disabled = false; $('send-button').disabled = state.sending; $('search-input').value = ''; $('load-older').hidden = true;
  renderChannels(); renderMessages(true);
  if (state.demo) { notice('Mode démo : les messages restent dans cet onglet et ne sont pas envoyés à Discord.'); return; }
  notice('Chargement de l’historique…');
  await loadMessages(false, revision);
}
function mergeMessages(channelId, incoming) {
  const map = new Map((state.cache.get(channelId) || []).map(m => [m.id, m]));
  incoming.forEach(m => map.set(m.id, { ...map.get(m.id), ...m }));
  state.cache.set(channelId, [...map.values()].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp) || (a.id < b.id ? -1 : 1)));
}
async function loadMessages(older = false, revision = state.revision) {
  const channel = state.channel, client = state.client;
  if (!channel || state.demo || state.historyLoading) return;
  state.historyLoading = true; $('load-older').disabled = true;
  const messages = state.cache.get(channel.id) || [];
  const scroll = $('message-scroller'), height = scroll.scrollHeight, top = scroll.scrollTop;
  try {
    const result = await client.messages(channel.id, older ? messages[0]?.id : undefined);
    if (revision !== state.revision) return;
    mergeMessages(channel.id, result);
    if (older || !messages.length || result.length === 50) state.hasOlder = result.length === 50;
    renderMessages(!older);
    if (older) scroll.scrollTop = top + scroll.scrollHeight - height;
    notice(result.some(m => !m.content && !m.attachments?.length && !m.embeds?.length) ? 'Certains messages n’ont pas de contenu accessible. Vérifiez « Message Content Intent » dans le Developer Portal.' : '');
  } catch (e) { if (revision === state.revision) error(e); }
  finally { if (revision === state.revision) { state.historyLoading = false; $('load-older').disabled = false; } }
}
function openImage(src, filename, original) {
  $('viewer-image').src = src; $('viewer-image').alt = filename; $('viewer-title').textContent = filename; $('viewer-original').href = original;
  $('image-dialog').showModal();
}
function renderMessages(bottom = false) {
  const messages = state.cache.get(state.channel?.id) || [];
  const context = { users: Object.fromEntries(messages.map(m => [m.author.id, name(m.author)])), channels: Object.fromEntries(state.channels.map(c => [c.id, c.name])), roles: Object.fromEntries((state.guild?.roles || []).map(r => [r.id, r.name])) };
  const search = $('search-input').value.trim().toLocaleLowerCase();
  const nodes = []; let day = '';
  for (const message of messages.filter(m => !search || `${m.content || ''} ${name(m.author)}`.toLocaleLowerCase().includes(search))) {
    const date = new Date(message.timestamp), label = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    if (day !== label) { day = label; nodes.push(el('div', 'day-divider', label)); }
    const row = el('article', 'message'); row.dataset.id = message.id;
    const content = el('div', 'message-content'), heading = el('div', 'message-heading');
    heading.append(el('strong', '', name(message.author)));
    if (message.author.bot) heading.append(el('span', 'bot-tag', 'APP'));
    const time = el('time', '', date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })); time.dateTime = message.timestamp; time.title = date.toLocaleString('fr-FR'); heading.append(time);
    const text = el('div', 'message-text'); renderMarkdown(text, message.content || (message.attachments?.length || message.embeds?.length ? '' : 'Contenu non disponible.'), false, context);
    content.append(heading, text);
    const attachments = el('div', 'attachments');
    for (const attachment of message.attachments || []) { const rendered = renderAttachment(attachment, { key: `${message.id}-${attachment.id || attachment.filename}`, openImage }); if (rendered) attachments.append(rendered); }
    if (attachments.childNodes.length) content.append(attachments);
    for (const [index, embed] of (message.embeds || []).entries()) { const rendered = renderEmbed(embed, { key: `${message.id}-embed-${index}`, openImage, context }); if (rendered) content.append(rendered); }
    if (message.referenced_message) { const reply = el('div', 'reply-preview'); reply.append(el('strong', '', name(message.referenced_message.author)), el('span', '', (message.referenced_message.content || 'Pièce jointe').slice(0, 120))); content.prepend(reply); }
    row.append(avatar(message.author), content);
    if (message.author.id === state.user.id) { const button = el('button', 'delete-message', 'Supprimer'); button.addEventListener('click', () => deleteMessage(message, button)); row.append(button); }
    nodes.push(row);
  }
  if (!nodes.length) nodes.push(el('p', 'empty-state', search ? 'Aucun message chargé ne correspond à votre recherche.' : 'Aucun message pour le moment. Lancez la conversation !'));
  $('messages').replaceChildren(...nodes); $('load-older').hidden = state.demo || !state.hasOlder || Boolean(search);
  renderMembers(messages);
  if (bottom) $('message-scroller').scrollTop = $('message-scroller').scrollHeight;
}
function renderMembers(messages) {
  const authors = [...new Map(messages.map(m => [m.author.id, m.author])).values()];
  $('member-count').textContent = authors.length;
  $('member-list').replaceChildren(...authors.map(user => { const row = el('div', 'member'); const label = el('span', 'member-name', name(user)); row.append(avatar(user), label); if (user.bot) row.append(el('span', 'bot-tag', 'APP')); return row; }));
}
async function deleteMessage(message, button) {
  if (!confirm('Supprimer ce message ? Cette action est définitive.')) return;
  const session = state.session; button.disabled = true;
  try {
    if (!state.demo) await state.client.delete(message.channel_id, message.id);
    if (session !== state.session) return;
    state.cache.set(message.channel_id, (state.cache.get(message.channel_id) || []).filter(m => m.id !== message.id));
    if (state.channel?.id === message.channel_id) renderMessages();
  } catch (e) { if (session === state.session) { error(e); button.disabled = false; } }
}
function gatewayEvent(type, data) {
  if (type === 'MESSAGE_CREATE' || type === 'MESSAGE_UPDATE') {
    if (!data.author && !(state.cache.get(data.channel_id) || []).some(m => m.id === data.id)) return;
    mergeMessages(data.channel_id, [data]);
    if (data.channel_id === state.channel?.id) { const scroll = $('message-scroller'), bottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 150; renderMessages(bottom); }
  } else if (type === 'MESSAGE_DELETE' || type === 'MESSAGE_DELETE_BULK') {
    const ids = new Set(data.ids || [data.id]); state.cache.set(data.channel_id, (state.cache.get(data.channel_id) || []).filter(m => !ids.has(m.id))); if (state.channel?.id === data.channel_id) renderMessages();
  } else if (['CHANNEL_CREATE', 'CHANNEL_UPDATE', 'CHANNEL_DELETE'].includes(type) && data.guild_id === state.guild?.id) {
    state.channels = state.channels.filter(c => c.id !== data.id); if (type !== 'CHANNEL_DELETE') state.channels.push(data); state.channels.sort((a, b) => a.position - b.position); renderChannels();
    if (state.channel?.id === data.id) { if (type === 'CHANNEL_DELETE') selectGuild(state.guild); else { state.channel = data; $('channel-title').textContent = data.name; $('channel-topic').textContent = data.topic || ''; } }
  } else if (type === 'GUILD_CREATE' || type === 'GUILD_UPDATE') {
    const existing = state.guilds.find(g => g.id === data.id); if (existing) Object.assign(existing, data); else state.guilds.push(data); renderGuilds();
  } else if (type === 'GUILD_DELETE' && !data.unavailable) {
    state.guilds = state.guilds.filter(g => g.id !== data.id); renderGuilds(); if (state.guild?.id === data.id) { if (state.guilds.length) selectGuild(state.guilds[0]); else home(); }
  }
}
function logout() {
  ++state.session; ++state.revision;
  state.gateway?.stop(); state.client?.stop();
  clearMediaState(); $('image-dialog').close(); $('viewer-image').removeAttribute('src');
  Object.assign(state, { client: null, gateway: null, user: null, guilds: [], guild: null, channel: null, channels: [], demo: false, sending: false, historyLoading: false, hasOlder: false }); state.cache.clear();
  $('settings-dialog').close(); $('token').value = ''; $('token').type = 'password'; $('toggle-token').setAttribute('aria-label', 'Afficher le token'); $('app-view').hidden = true; $('login-view').hidden = false; $('login-error').hidden = true; $('connect-button').disabled = false; $('connect-button').textContent = 'Se connecter'; $('demo-button').disabled = false; $('message-input').value = ''; document.body.classList.remove('sidebar-open'); notice();
}
function home() {
  ++state.revision; state.guild = null; state.channel = null; state.channels = [];
  renderGuilds(); $('server-name').textContent = 'Vos serveurs'; $('channel-list').replaceChildren(el('p', 'empty-state', 'Choisissez un serveur dans la barre de gauche.')); $('channel-title').textContent = 'Bienvenue'; $('channel-topic').textContent = 'Votre espace pour piloter votre bot.'; $('messages').replaceChildren(); $('member-list').replaceChildren(); $('member-count').textContent = '0'; $('load-older').hidden = true; $('welcome-title').textContent = 'Bienvenue sur LiveBot'; $('welcome-description').textContent = 'Choisissez un serveur, ou utilisez + pour y inviter votre bot.'; $('message-input').disabled = true; $('message-input').value = ''; $('send-button').disabled = true;
}
$('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (state.client) return;
  let token = $('token').value.trim().replace(/^Bot\s+/i, '');
  if (!token || /\s/.test(token)) { $('login-error').textContent = 'Collez un token de bot valide, sans espaces.'; $('login-error').hidden = false; return; }
  const relayURL = $('relay-url').value.trim();
  if (relayURL && !$('relay-consent').checked) { $('login-error').textContent = 'Confirmez que vous faites confiance à ce relais : il recevra le token pour contacter Discord.'; $('login-error').hidden = false; return; }
  let client;
  try { client = new DiscordClient(token, globalThis.fetch, relayURL); }
  catch (e) { $('login-error').textContent = e.message; $('login-error').hidden = false; return; }
  const session = ++state.session;
  state.client = client; $('connect-button').disabled = true; $('demo-button').disabled = true; $('connect-button').textContent = 'Connexion à Discord…'; $('login-error').hidden = true;
  try {
    await client.prepare();
    const user = await client.me();
    if (!user.bot) throw new Error('Seuls les tokens de bots sont acceptés.');
    const guilds = await client.guilds(), gatewayInfo = await client.gateway();
    if (session !== state.session) return;
    Object.assign(state, { user, guilds, demo: false });
    state.gateway = new Gateway({ token, url: gatewayInfo.url, contentIntent: $('content-intent').checked, onEvent: (type, data) => { if (session === state.session) gatewayEvent(type, data); }, onStatus: (status, detail) => { if (session === state.session) setStatus(status, detail); } });
    token = ''; $('token').value = ''; showApp(); state.gateway.start();
    if (guilds.length) await selectGuild(guilds[0]); else { home(); notice('Votre bot n’a encore aucun serveur. Utilisez + pour l’inviter.'); }
  } catch (e) {
    if (session !== state.session) return;
    client.stop(); state.client = null; token = ''; $('token').value = ''; $('login-error').textContent = e.message; $('login-error').hidden = false; $('connect-button').disabled = false; $('demo-button').disabled = false; $('connect-button').textContent = 'Se connecter';
  }
});
$('demo-button').addEventListener('click', () => { ++state.session; state.demo = true; demoData(); showApp(); setStatus('demo'); selectGuild(state.guilds[0]); });
$('toggle-token').addEventListener('click', () => { const show = $('token').type === 'password'; $('token').type = show ? 'text' : 'password'; $('toggle-token').setAttribute('aria-label', show ? 'Masquer le token' : 'Afficher le token'); });
$('message-form').addEventListener('submit', async event => {
  event.preventDefault(); const content = $('message-input').value.trim(), channel = state.channel, session = state.session;
  if (!content || !channel || state.sending) return;
  state.sending = true; $('send-button').disabled = true;
  try {
    const result = state.demo ? { id: `demo-${crypto.randomUUID()}`, channel_id: channel.id, content, author: state.user, timestamp: new Date().toISOString() } : await state.client.send(channel.id, content);
    if (session !== state.session) return;
    mergeMessages(channel.id, [result]);
    if (state.channel?.id === channel.id) { if ($('message-input').value.trim() === content) { $('message-input').value = ''; $('message-input').style.height = 'auto'; $('character-count').textContent = '0/2000'; } renderMessages(true); }
  } catch (e) { if (session === state.session) error(e); }
  finally { if (session === state.session) { state.sending = false; $('send-button').disabled = !state.channel; } }
});
$('message-input').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('message-form').requestSubmit(); } });
$('message-input').addEventListener('input', () => { const input = $('message-input'); $('character-count').textContent = `${input.value.length}/2000`; input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 140)}px`; });
$('logout-button').addEventListener('click', logout);
$('home-button').addEventListener('click', home);
$('server-header').addEventListener('click', () => { if (state.guild) notice(`${state.guild.name} — seuls les salons accessibles avec les permissions du bot peuvent être lus.`); });
$('refresh-channels').addEventListener('click', () => { if (state.guild) selectGuild(state.guild); });
$('refresh-messages').addEventListener('click', () => { if (state.demo) renderMessages(true); else loadMessages(); });
$('load-older').addEventListener('click', () => loadMessages(true));
$('search-input').addEventListener('input', () => renderMessages());
$('mobile-menu').addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
$('members-button').addEventListener('click', () => { const narrow = matchMedia('(max-width:1100px)').matches; document.body.classList.toggle(narrow ? 'show-members' : 'narrow-members'); $('members-button').setAttribute('aria-pressed', String(narrow ? document.body.classList.contains('show-members') : !document.body.classList.contains('narrow-members'))); });
['settings-button', 'about-button'].forEach(id => $(id).addEventListener('click', () => $('settings-dialog').showModal()));
$('close-settings').addEventListener('click', () => $('settings-dialog').close());
$('compact-toggle').addEventListener('change', event => document.body.classList.toggle('compact', event.target.checked));
$('invite-button').addEventListener('click', () => {
  if (state.demo) { notice('Connectez votre bot pour générer son lien d’invitation.'); return; }
  const url = new URL('https://discord.com/oauth2/authorize'); url.searchParams.set('client_id', state.user.id); url.searchParams.set('scope', 'bot'); url.searchParams.set('permissions', '68608'); window.open(url.href, '_blank', 'noopener,noreferrer');
});
window.addEventListener('pagehide', logout);
const localPage = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
$('relay-url').value = localPage ? '' : config.relayURL || '';
$('relay-consent-row').hidden = !$('relay-url').value;
$('relay-url').addEventListener('input', () => { $('relay-consent').checked = false; $('relay-consent-row').hidden = !$('relay-url').value.trim(); });
$('connection-check').addEventListener('click', async () => {
  const button = $('connection-check');
  button.disabled = true; $('connection-result').hidden = false;
  $('connection-result').classList.remove('error-text');
  $('connection-result').textContent = 'Vérification sans token…';
  try {
    const result = await probeConnection($('relay-url').value.trim());
    $('connection-result').textContent = `Connexion réussie à ${result.endpoint}. Aucun token envoyé. ${result.direct ? 'Accès direct disponible.' : 'Le relais est accessible depuis cet onglet.'} Si la connexion du bot échoue encore, vérifiez le token ; une extension peut aussi filtrer les requêtes authentifiées.`;
  } catch (e) {
    $('connection-result').classList.add('error-text');
    $('connection-result').textContent = e.message;
  } finally { button.disabled = false; }
});
document.querySelectorAll('[data-icon]').forEach(node => node.replaceChildren(icon(node.dataset.icon)));
const controlIcons = { 'settings-button': 'settings', 'logout-button': 'logout', 'refresh-channels': 'refresh', 'refresh-messages': 'refresh', 'members-button': 'members', 'mobile-menu': 'menu', 'send-button': 'send', 'close-settings': 'close', 'invite-button': 'plus', 'about-button': 'help', 'close-image': 'close' };
Object.entries(controlIcons).forEach(([id, symbol]) => $(id).replaceChildren(icon(symbol)));
$('close-image').addEventListener('click', () => $('image-dialog').close());
$('image-dialog').addEventListener('click', event => { if (event.target === $('image-dialog')) $('image-dialog').close(); });
const formats = { bold: ['**', '**'], italic: ['*', '*'], underline: ['__', '__'], strike: ['~~', '~~'], spoiler: ['||', '||'], code: ['`', '`'], block: ['```\n', '\n```'] };
function insertFormat(format) {
  const input = $('message-input'); if (input.disabled) return;
  const [before, after] = formats[format]; const start = input.selectionStart, end = input.selectionEnd;
  const content = input.value.slice(start, end) || (format === 'block' ? 'code' : 'texte');
  if (input.value.length + before.length + after.length + (end === start ? content.length : 0) > 2000) return;
  input.setRangeText(before + content + after, start, end, 'end'); input.setSelectionRange(start + before.length, start + before.length + content.length); input.focus(); input.dispatchEvent(new Event('input'));
}
document.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => insertFormat(button.dataset.format)));
$('message-input').addEventListener('keydown', event => { if (!(event.ctrlKey || event.metaKey) || event.altKey) return; const format = { b: 'bold', i: 'italic', u: 'underline' }[event.key.toLowerCase()]; if (format) { event.preventDefault(); insertFormat(format); } });
