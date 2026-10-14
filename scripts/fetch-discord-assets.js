import { mkdir, writeFile } from 'node:fs/promises';
const assets = {
  'login-artwork.svg': 'https://discord.com/assets/d8680b1c1576ecc8.svg',
  'discord-wordmark.svg': 'https://discord.com/assets/131c318dd45b7aa4.svg',
  'discord-symbol.svg': 'https://cdn.prod.website-files.com/6257adef93867e50d84d30e2/66e3d80db9971f10a9757c99_Symbol.svg',
  'gg-sans-regular.woff2': 'https://discord.com/assets/66d715454104d24e.woff2',
  'gg-sans-semibold.woff2': 'https://discord.com/assets/2df2c3ff74408972.woff2',
  'gg-sans-bold.woff2': 'https://discord.com/assets/189422196a4f8b53.woff2',
  'gg-mono.woff2': 'https://discord.com/assets/249d0a057895c668.woff2'
};
await mkdir('assets/discord', { recursive: true });
await Promise.all(Object.entries(assets).map(async ([filename, url]) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`);
  await writeFile(`assets/discord/${filename}`, new Uint8Array(await response.arrayBuffer()));
  console.log(filename);
}));
await writeFile('assets/discord/sources.json', JSON.stringify({ source: 'Discord official login page and brand assets', inspected: '2026-10-14', branding: 'https://discord.com/branding', assets }, null, 2) + '\n');
