const system = new Map([
  [1, 'a ajouté un destinataire à la conversation.'], [2, 'a retiré un destinataire de la conversation.'], [3, 'a lancé un appel.'],
  [4, 'a changé le nom du salon.'], [5, 'a changé l’icône du salon.'], [6, 'a épinglé un message.'], [7, 'a rejoint le serveur.'],
  [8, 'a boosté le serveur.'], [9, 'a fait passer le serveur au niveau de boost 1.'], [10, 'a fait passer le serveur au niveau de boost 2.'], [11, 'a fait passer le serveur au niveau de boost 3.'],
  [12, 'a ajouté un salon de suivi.'], [18, 'a créé un fil de discussion.'], [21, 'Message à l’origine du fil de discussion.'], [22, 'a envoyé un rappel.'],
  [23, 'Commande de menu contextuel.'], [24, 'Message de modération automatique.'], [25, 'a démarré une scène.'], [26, 'a terminé une scène.'], [27, 'Intervenant sur scène.'],
  [28, 'Sujet de la scène modifié.'], [29, 'Notification d’abonnement.'], [31, 'Le serveur est éligible à une offre.'], [32, 'Rappel d’événement.'], [36, 'Événement d’abonnement.']
]);
export function componentText(components = []) {
  return components.flatMap(component => [component.type === 10 ? component.content || '' : '', ...componentText(component.components || []), ...(component.accessory ? componentText([component.accessory]) : [])]).filter(Boolean);
}
export function hasMessagePayload(message) {
  return Boolean(message.content || message.attachments?.length || message.embeds?.length || message.sticker_items?.length || message.stickers?.length || message.poll || message.components?.length || message.message_snapshots?.length);
}
export function messageFallback(message) {
  if (hasMessagePayload(message)) return { kind: 'payload', text: '' };
  const type = Number(message.type || 0);
  if (system.has(type)) return { kind: 'system', text: system.get(type) };
  if (![0, 19, 20].includes(type)) return { kind: 'system', text: `Événement Discord (type ${type}).` };
  return { kind: 'unavailable', text: 'Discord n’a transmis aucun texte, média ou aperçu pour ce message.' };
}

export const Permissions = { ADMINISTRATOR: 8n, MANAGE_CHANNELS: 16n, VIEW_CHANNEL: 1024n, SEND_MESSAGES: 2048n, MANAGE_MESSAGES: 8192n, READ_MESSAGE_HISTORY: 65536n };
const bits = value => { try { return BigInt(value || 0); } catch { return 0n; } };
export function channelPermissions(guild, channel, roles, member, botId) {
  if (channel?.type === 1) return Permissions.VIEW_CHANNEL | Permissions.SEND_MESSAGES | Permissions.READ_MESSAGE_HISTORY;
  if (!guild || !roles || !member) return null;
  if (guild.owner_id === botId) return Object.values(Permissions).reduce((all, flag) => all | flag, 0n);
  const ids = new Set([guild.id, ...(member.roles || [])]);
  let permissions = roles.filter(role => ids.has(role.id)).reduce((all, role) => all | bits(role.permissions), 0n);
  if (permissions & Permissions.ADMINISTRATOR) return Object.values(Permissions).reduce((all, flag) => all | flag, permissions);
  const overrides = channel?.permission_overwrites || [];
  const everyone = overrides.find(o => o.id === guild.id && o.type === 0);
  if (everyone) permissions = (permissions & ~bits(everyone.deny)) | bits(everyone.allow);
  let allow = 0n, deny = 0n;
  for (const override of overrides.filter(o => o.type === 0 && o.id !== guild.id && ids.has(o.id))) { allow |= bits(override.allow); deny |= bits(override.deny); }
  permissions = (permissions & ~deny) | allow;
  const personal = overrides.find(o => o.type === 1 && o.id === botId);
  if (personal) permissions = (permissions & ~bits(personal.deny)) | bits(personal.allow);
  if (!(permissions & Permissions.VIEW_CHANNEL)) return 0n;
  return permissions;
}
export function mayDeleteMessage(message, botId, permissions) { return message.author?.id === botId || Boolean(permissions != null && (permissions & Permissions.MANAGE_MESSAGES)); }
