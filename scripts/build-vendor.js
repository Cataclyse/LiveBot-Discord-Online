import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('assets/vendor', { recursive: true });
await build({ stdin: { contents: "export {default as MarkdownIt} from 'markdown-it'; export {default as hljs} from 'highlight.js/lib/common';", resolveDir: process.cwd() }, bundle: true, minify: true, format: 'esm', platform: 'browser', outfile: 'assets/vendor/markdown.js', legalComments: 'linked' });
await copyFile('node_modules/markdown-it/LICENSE', 'assets/vendor/markdown-it.LICENSE');
await copyFile('node_modules/highlight.js/LICENSE', 'assets/vendor/highlight-js.LICENSE');
for (const [packageName, licenseFile] of [['entities', 'LICENSE'], ['linkify-it', 'LICENSE'], ['uc.micro', 'LICENSE.txt'], ['mdurl', 'LICENSE'], ['punycode.js', 'LICENSE-MIT.txt']]) {
  await copyFile(`node_modules/${packageName}/${licenseFile}`, `assets/vendor/${packageName}.LICENSE`);
}
console.log('Browser Markdown and syntax highlighting bundle ready.');
