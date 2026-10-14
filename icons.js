// Vector controls, without Unicode pictograms or decorative emoji.
const paths = {
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 2M4 17l2 2a8 8 0 0 0 13-2"/>',
  members: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/>',
  settings: '<path d="m9 3-1 3-3 1-2 3 2 2v3l3 1 1 3h4l1-3 3-1v-3l2-2-2-3-3-1-1-3H9Z"/><circle cx="11" cy="11" r="3"/>',
  logout: '<path d="M10 3H4v18h6M14 8l5 4-5 4M8 12h11"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  send: '<path d="m3 3 18 9-18 9 4-9-4-9Z M7 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 0-1 1-1 2M12 17h.01"/>',
  bot: '<rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M1 12v4M23 12v4M8 16h8"/><circle cx="8" cy="12" r=".5"/><circle cx="16" cy="12" r=".5"/>',
  file: '<path d="M14 2H5v20h14V7l-5-5Z M14 2v5h5M8 12h8M8 16h6"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  format: '<path d="m3 19 5-14 5 14M5 14h6M15 9h6M18 9v10"/>'
};
export function icon(name) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('viewBox', '0 0 24 24'); node.setAttribute('fill', 'none'); node.setAttribute('stroke', 'currentColor'); node.setAttribute('stroke-width', '1.8'); node.setAttribute('stroke-linecap', 'round'); node.setAttribute('stroke-linejoin', 'round'); node.setAttribute('aria-hidden', 'true'); node.classList.add('ui-icon');
  // Only trusted icon constants are inserted here.
  node.innerHTML = paths[name] || paths.help;
  return node;
}
