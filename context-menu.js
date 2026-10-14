let returnFocus;
export function closeContextMenu(focus = false) {
  const menu = document.getElementById('context-menu'); menu.hidden = true; menu.replaceChildren();
  if (focus && returnFocus?.isConnected) returnFocus.focus();
}
export function showContextMenu(event, actions) {
  event.preventDefault(); event.stopPropagation(); closeContextMenu();
  const menu = document.getElementById('context-menu'); returnFocus = event.currentTarget;
  for (const action of actions) {
    if (!action) { const divider = document.createElement('div'); divider.className = 'context-divider'; divider.setAttribute('role', 'separator'); menu.append(divider); continue; }
    const button = document.createElement('button'); button.type = 'button'; button.setAttribute('role', 'menuitem'); button.textContent = action.label; button.disabled = Boolean(action.disabled); if (action.danger) button.className = 'danger'; if (action.reason) button.title = action.reason;
    button.addEventListener('click', () => { closeContextMenu(); Promise.resolve().then(action.run).catch(error => { const notice = document.getElementById('app-notice'); notice.textContent = error.message; notice.hidden = false; notice.classList.add('error'); }); }); menu.append(button);
  }
  menu.hidden = false;
  const bounds = menu.getBoundingClientRect(), anchor = event.currentTarget.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(event.clientX || anchor.left, innerWidth - bounds.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(event.clientY || anchor.bottom, innerHeight - bounds.height - 8))}px`;
  menu.querySelector('button:not(:disabled)')?.focus();
}
document.addEventListener('pointerdown', event => { if (!event.target.closest('#context-menu')) closeContextMenu(); });
document.addEventListener('keydown', event => {
  const menu = document.getElementById('context-menu'); if (menu.hidden) return;
  if (event.key === 'Escape') { event.preventDefault(); closeContextMenu(true); return; }
  if (event.key === 'Tab') { closeContextMenu(); return; }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault(); const items = [...menu.querySelectorAll('button:not(:disabled)')]; if (!items.length) return;
  const position = items.indexOf(document.activeElement); const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (position + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items[next].focus();
});
window.addEventListener('resize', () => closeContextMenu());
