import { MarkdownIt, hljs } from './assets/vendor/markdown.js';

const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false,
  highlight(code, language) {
    if (language && hljs.getLanguage(language)) {
      try { return hljs.highlight(code, { language, ignoreIllegals: true }).value; } catch { /* Plain code fallback. */ }
    }
    return md.utils.escapeHtml(code);
  }
});
md.disable(['table', 'hr', 'lheading']);
const nativeText = md.inline.ruler.__rules__.find(rule => rule.name === 'text').fn;
md.inline.ruler.at('text', (state, silent) => {
  const next = state.src.indexOf('||', state.pos);
  if (next === state.pos) return false;
  const limit = state.posMax;
  if (next > state.pos && next < limit) state.posMax = next;
  try { return nativeText(state, silent); } finally { state.posMax = limit; }
});
md.inline.ruler.before('text', 'discord-delimiters', (state, silent) => {
  const marker = state.src.slice(state.pos, state.pos + 2);
  if (!['__', '||'].includes(marker)) return false;
  let end = state.pos + 2;
  for (;;) {
    end = state.src.indexOf(marker, end);
    if (end < 0) return false;
    let slashes = 0;
    for (let i = end - 1; i >= 0 && state.src[i] === '\\'; i--) slashes++;
    if (slashes % 2 === 0) break;
    end += 2;
  }
  const inner = state.src.slice(state.pos + 2, end);
  if (!inner || (marker === '__' && /^\s|\s$/.test(inner))) return false;
  if (!silent) {
    const spoiler = marker === '||';
    const open = state.push(spoiler ? 'spoiler_open' : 'underline_open', spoiler ? 'span' : 'u', 1);
    if (spoiler) open.attrs = [['class', 'spoiler'], ['role', 'button'], ['tabindex', '0'], ['aria-expanded', 'false'], ['aria-label', 'Afficher le texte masqué']];
    const children = [];
    state.md.inline.parse(inner, state.md, state.env, children);
    state.tokens.push(...children);
    state.push(spoiler ? 'spoiler_close' : 'underline_close', spoiler ? 'span' : 'u', -1);
  }
  state.pos = end + 2;
  return true;
});
md.block.ruler.before('heading', 'discord-subtext', (state, start, end, silent) => {
  const line = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]);
  if (!line.startsWith('-# ')) return false;
  if (!silent) {
    const open = state.push('paragraph_open', 'p', 1); open.attrs = [['class', 'subtext']];
    const inline = state.push('inline', '', 0); inline.content = line.slice(3); inline.children = [];
    state.push('paragraph_close', 'p', -1);
  }
  state.line = start + 1;
  return true;
});
md.block.ruler.before('blockquote', 'discord-multiquote', (state, start, end, silent) => {
  const line = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]);
  if (!line.startsWith('>>> ')) return false;
  if (!silent) {
    state.push('blockquote_open', 'blockquote', 1);
    const source = line.slice(4) + '\n' + state.src.slice(state.bMarks[start + 1] || state.src.length);
    const tokens = []; state.md.block.parse(source, state.md, state.env, tokens); state.tokens.push(...tokens);
    state.push('blockquote_close', 'blockquote', -1);
  }
  state.line = end;
  return true;
});
const defaultLink = md.renderer.rules.link_open || ((tokens, i, options, env, self) => self.renderToken(tokens, i, options));
md.inline.ruler.before('autolink', 'discord-references', (state, silent) => {
  const source = state.src.slice(state.pos);
  const mention = source.match(/^<(?:@(!|&)?|(#))(\d{1,20})>/);
  const timestamp = source.match(/^<t:(\d{1,12})(?::([tTdDfFR]))?>/);
  if (!mention && !timestamp) return false;
  if (!silent) {
    const token = state.push('discord_reference', 'span', 0);
    token.meta = mention ? { kind: mention[2] ? 'channel' : mention[1] === '&' ? 'role' : 'user', id: mention[3] } : { kind: 'timestamp', seconds: Number(timestamp[1]), format: timestamp[2] || 'f' };
  }
  state.pos += (mention || timestamp)[0].length;
  return true;
});
md.renderer.rules.discord_reference = (tokens, i, options, env) => {
  const reference = tokens[i].meta;
  if (reference.kind === 'timestamp') {
    const date = new Date(reference.seconds * 1000);
    const format = reference.format;
    let text;
    if (format === 'R') { const seconds = (date.getTime() - Date.now()) / 1000; const unit = Math.abs(seconds) >= 86400 ? 'day' : Math.abs(seconds) >= 3600 ? 'hour' : Math.abs(seconds) >= 60 ? 'minute' : 'second'; const divider = {day:86400,hour:3600,minute:60,second:1}[unit]; text = new Intl.RelativeTimeFormat('fr-FR', {numeric:'auto'}).format(Math.round(seconds/divider), unit); }
    else if ('tT'.includes(format)) text = date.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit', ...(format === 'T' ? {second:'2-digit'} : {})});
    else if ('dD'.includes(format)) text = date.toLocaleDateString('fr-FR', {dateStyle:format === 'D' ? 'long' : 'short'});
    else text = date.toLocaleString('fr-FR', {dateStyle:format === 'F' ? 'full' : 'long',timeStyle:'short'});
    return '<span class="discord-timestamp" title="' + md.utils.escapeHtml(date.toLocaleString('fr-FR')) + '">' + md.utils.escapeHtml(text) + '</span>';
  }
  const collection = reference.kind === 'channel' ? env.channels : reference.kind === 'role' ? env.roles : env.users;
  const text = (reference.kind === 'channel' ? '#' : '@') + (collection?.[reference.id] || reference.id);
  return '<span class="discord-mention">' + md.utils.escapeHtml(text) + '</span>';
};
md.renderer.rules.link_open = (tokens, i, options, env, self) => {
  tokens[i].attrSet('target', '_blank'); tokens[i].attrSet('rel', 'noopener noreferrer');
  return defaultLink(tokens, i, options, env, self);
};
md.renderer.rules.image = (tokens, i) => {
  // Discord does not use Markdown image syntax; show its text rather than
  // turning arbitrary message content into an automatically loaded resource.
  const token = tokens[i];
  return md.utils.escapeHtml(`![${token.content}](${token.attrGet('src')})`);
};

export function markdownHTML(source, inline = false, context = {}) { return inline ? md.renderInline(String(source || ''), context) : md.render(String(source || ''), context); }
export function renderMarkdown(node, source, inline = false, context = {}) {
  // HTML comes exclusively from markdown-it with raw HTML disabled, validated
  // links and escaped code. Message HTML is never inserted directly.
  node.innerHTML = markdownHTML(source, inline, context);
  const reveal = event => {
    const spoiler = event.target.closest?.('.spoiler:not(.revealed)');
    if (!spoiler || !node.contains(spoiler)) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    spoiler.classList.add('revealed'); spoiler.setAttribute('aria-expanded', 'true'); spoiler.removeAttribute('aria-label');
  };
  node.addEventListener('click', reveal, true); node.addEventListener('keydown', reveal, true);
  node.querySelectorAll('.spoiler:not(.revealed) a').forEach(link => { link.tabIndex = -1; });
  node.addEventListener('click', () => { node.querySelectorAll('.spoiler.revealed a').forEach(link => { link.tabIndex = 0; }); });
  node.querySelectorAll('pre').forEach(pre => {
    const button = document.createElement('button'); button.className = 'copy-code'; button.type = 'button'; button.textContent = 'Copier';
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(pre.querySelector('code').textContent); button.textContent = 'Copié'; }
      catch { button.textContent = 'Copie indisponible'; }
      setTimeout(() => { button.textContent = 'Copier'; }, 1600);
    }); pre.append(button);
  });
}

export function safeURL(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function mediaKind(attachment) {
  const type = attachment.content_type || '';
  const filename = attachment.filename || safeURL(attachment.url)?.split('?')[0] || '';
  if (type.startsWith('image/') || /\.(?:png|jpe?g|gif|webp|avif|svg)$/i.test(filename)) return 'image';
  if (type.startsWith('video/') || /\.(?:mp4|webm|mov)$/i.test(filename)) return 'video';
  if (type.startsWith('audio/') || /\.(?:mp3|ogg|wav|m4a|flac)$/i.test(filename)) return 'audio';
  return 'file';
}
export function isSpoiler(attachment) { return Boolean(attachment.spoiler || attachment.is_spoiler || (Number(attachment.flags) & 8) || attachment.filename?.startsWith('SPOILER_')); }
export function attachmentSource(attachment) {
  return safeURL(attachment.proxy_url) || safeURL(attachment.url);
}
