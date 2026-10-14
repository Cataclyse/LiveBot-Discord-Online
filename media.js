import { renderMarkdown, safeURL, mediaKind, isSpoiler, attachmentSource } from './message-content.js';
const node = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const revealed = new Set();
export function clearMediaState() { revealed.clear(); }
function externalLink(url, text, cls) {
  const link = node('a', cls, text); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
}
export function renderAttachment(attachment, { key, openImage }) {
  const src = attachmentSource(attachment), original = safeURL(attachment.url) || src;
  if (!src) return null;
  const kind = mediaKind(attachment), filename = attachment.filename || 'Pièce jointe';
  const frame = node('div', `attachment attachment-${kind}`);
  const fallback = externalLink(original, `${filename} — ouvrir le fichier`, 'media-fallback'); fallback.hidden = true;
  let media;
  if (kind === 'image') {
    const button = node('button', 'image-open'); button.type = 'button'; button.setAttribute('aria-label', `Agrandir ${filename}`);
    media = node('img', 'message-image'); media.src = src; media.alt = attachment.description || filename; media.loading = 'lazy'; media.referrerPolicy = 'no-referrer';
    if (attachment.width > 0 && attachment.height > 0) { media.width = attachment.width; media.height = attachment.height; media.style.aspectRatio = `${attachment.width}/${attachment.height}`; }
    button.append(media); button.addEventListener('click', () => openImage(src, filename, original)); frame.append(button);
  } else if (kind === 'video' || kind === 'audio') {
    media = node(kind, 'message-' + kind); media.src = src; media.controls = true; media.preload = 'metadata';
    if (kind === 'video') { media.playsInline = true; if (attachment.width && attachment.height) media.style.aspectRatio = `${attachment.width}/${attachment.height}`; }
    frame.append(media);
  } else {
    const link = externalLink(original, filename, 'file-attachment');
    if (attachment.size) link.append(node('small', '', `${(attachment.size / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Ko`));
    frame.append(link);
  }
  if (media) { media.addEventListener('error', () => { media.hidden = true; fallback.hidden = false; }); frame.append(fallback); }
  if (isSpoiler(attachment) && !revealed.has(key)) {
    const cover = node('button', 'media-spoiler-cover', 'SPOILER'); cover.type = 'button'; cover.setAttribute('aria-label', 'Afficher la pièce jointe masquée');
    frame.classList.add('media-hidden');
    for (const child of frame.children) child.setAttribute('aria-hidden', 'true');
    frame.querySelectorAll('a, button, video, audio').forEach(item => { item.tabIndex = -1; });
    cover.addEventListener('click', () => { revealed.add(key); frame.classList.remove('media-hidden'); frame.querySelectorAll('a, button, video, audio').forEach(item => { item.tabIndex = 0; }); for (const child of frame.children) child.removeAttribute('aria-hidden'); cover.remove(); });
    frame.append(cover);
  }
  return frame;
}
export function renderEmbed(embed, { key, openImage, context }) {
  const imageOnly = ['image', 'gifv'].includes(embed.type) && !embed.title && !embed.description && !embed.fields?.length;
  if (imageOnly) {
    const source = embed.type === 'gifv' ? embed.video : embed.image || embed.thumbnail || embed.video;
    if (!source) return null;
    return renderAttachment({ ...source, url: source.url, content_type: embed.type === 'gifv' || embed.type === 'video' ? 'video/mp4' : 'image/jpeg', filename: 'Aperçu' }, { key, openImage });
  }
  const box = node('div', 'message-embed');
  if (Number.isInteger(embed.color) && embed.color >= 0 && embed.color <= 0xffffff) box.style.borderLeftColor = '#' + embed.color.toString(16).padStart(6, '0');
  const body = node('div', 'embed-body');
  if (embed.provider?.name) body.append(node('small', 'embed-provider', embed.provider.name));
  if (embed.author?.name) {
    const author = node('div', 'embed-author');
    const iconURL = safeURL(embed.author.proxy_icon_url || embed.author.icon_url);
    if (iconURL) { const img = node('img'); img.src = iconURL; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; author.append(img); }
    const href = safeURL(embed.author.url); author.append(href ? externalLink(href, embed.author.name) : node('strong', '', embed.author.name)); body.append(author);
  }
  if (embed.title) { const href = safeURL(embed.url); body.append(href ? externalLink(href, embed.title, 'embed-title') : node('strong', 'embed-title', embed.title)); }
  if (embed.description) { const description = node('div', 'embed-description'); renderMarkdown(description, embed.description, false, context); body.append(description); }
  if (embed.fields?.length) {
    const fields = node('div', 'embed-fields');
    for (const field of embed.fields.slice(0, 25)) { const cell = node('div', 'embed-field'); if (field.inline) cell.classList.add('inline'); const title = node('strong'); renderMarkdown(title, field.name, true, context); const value = node('div'); renderMarkdown(value, field.value, false, context); cell.append(title, value); fields.append(cell); }
    body.append(fields);
  }
  box.append(body);
  if (embed.thumbnail) { const thumb = renderAttachment({ ...embed.thumbnail, content_type: 'image/jpeg', filename: 'Miniature' }, { key: key + '-thumb', openImage }); if (thumb) { thumb.classList.add('embed-thumbnail'); box.append(thumb); } }
  if (embed.image) { const image = renderAttachment({ ...embed.image, content_type: 'image/jpeg', filename: embed.title || 'Image' }, { key: key + '-image', openImage }); if (image) { image.classList.add('embed-image'); box.append(image); } }
  if (embed.video && !embed.image) {
    // Direct Discord video URLs are playable; provider iframe URLs remain links.
    const url = safeURL(embed.video.proxy_url || embed.video.url);
    if (url && /\.(?:mp4|webm)(?:\?|$)/i.test(url)) { const video = renderAttachment({ ...embed.video, content_type: 'video/mp4', filename: 'Vidéo' }, { key: key + '-video', openImage }); if (video) box.append(video); }
    else if (safeURL(embed.url)) box.append(externalLink(safeURL(embed.url), 'Ouvrir la vidéo', 'embed-video-link'));
  }
  if (embed.footer?.text || embed.timestamp) {
    const footer = node('div', 'embed-footer'); const iconURL = safeURL(embed.footer?.proxy_icon_url || embed.footer?.icon_url);
    if (iconURL) { const img = node('img'); img.src = iconURL; img.alt = ''; footer.append(img); }
    footer.append(node('span', '', [embed.footer?.text, embed.timestamp ? new Date(embed.timestamp).toLocaleString('fr-FR') : ''].filter(Boolean).join(' · '))); box.append(footer);
  }
  return box.childNodes.length ? box : null;
}
