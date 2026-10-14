import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownHTML, mediaKind, isSpoiler, safeURL, attachmentSource } from '../message-content.js';

test('Discord text formatting combines bold, italic, underline and strike', () => {
  const html = markdownHTML('**gras** *italique* __souligné__ ~~barré~~ __***combiné***__');
  for (const expected of ['<strong>gras</strong>', '<em>italique</em>', '<u>souligné</u>', '<s>barré</s>']) assert.ok(html.includes(expected), expected);
  assert.match(html, /<u><em><strong>combiné<\/strong><\/em><\/u>|<u><strong><em>combiné<\/em><\/strong><\/u>/);
});
test('spoilers contain nested formatting and support keyboard reveal', () => {
  const html = markdownHTML('avant ||**secret**|| après');
  assert.match(html, /class="spoiler"/); assert.match(html, /tabindex="0"/); assert.match(html, /aria-expanded="false"/); assert.match(html, /<strong>secret<\/strong>/);
  assert.doesNotMatch(markdownHTML('\\|\\|visible\\|\\|'), /class="spoiler"/);
});
test('code content is escaped and language syntax is highlighted', () => {
  const inline = markdownHTML('`<img onerror=alert(1)>`');
  assert.match(inline, /<code>&lt;img/); assert.doesNotMatch(inline, /<img/);
  const fence = markdownHTML('```javascript\nconst a = "hello";\n```');
  assert.match(fence, /language-javascript/); assert.match(fence, /hljs-keyword/);
  assert.doesNotMatch(markdownHTML('```unknown\n<script>alert(1)</script>\n```'), /<script>/);
});
test('raw HTML and executable links remain inert', () => {
  const html = markdownHTML('<img src=x onerror=alert(1)> <script>alert(1)</script> [bad](javascript:alert(1))');
  assert.doesNotMatch(html, /<img|<script|href="javascript:/);
  assert.match(html, /&lt;img/);
  assert.match(markdownHTML('[Discord](https://discord.com)'), /rel="noopener noreferrer"/);
});
test('lists, quotes, multiline quotes and subtext render as blocks', () => {
  assert.match(markdownHTML('- un\n- deux'), /<ul>/);
  assert.match(markdownHTML('> citation'), /<blockquote>/);
  assert.match(markdownHTML('>>> citation\nplusieurs lignes'), /<blockquote>/);
  assert.match(markdownHTML('-# secondaire'), /class="subtext"/);
});
test('signed Discord CDN URLs are preserved and media is identified', () => {
  const url = 'https://cdn.discordapp.com/attachments/1/2/image.png?ex=abc&is=def&hm=123';
  assert.equal(attachmentSource({ url }), url);
  assert.equal(mediaKind({ url, filename: 'image.png' }), 'image');
  assert.equal(mediaKind({ content_type: 'video/mp4' }), 'video');
  assert.equal(mediaKind({ filename: 'voice.ogg' }), 'audio');
  assert.equal(mediaKind({ filename: 'document.pdf' }), 'file');
  assert.ok(isSpoiler({ filename: 'SPOILER_image.png' })); assert.ok(isSpoiler({ flags: 8 }));
  assert.equal(safeURL('javascript:alert(1)'), null); assert.equal(safeURL('https://user:password@example.com'), null);
});
test('Discord mentions resolve names safely and timestamps render', () => {
  const html = markdownHTML('<@123> <#456> <@&789> <t:1700000000:d>', false, {users:{123:'<img onerror=alert(1)>'},channels:{456:'général'},roles:{789:'Équipe'}});
  assert.match(html, /@&lt;img/); assert.doesNotMatch(html, /<img/); assert.match(html, /#général/); assert.match(html, /@Équipe/); assert.match(html, /discord-timestamp/);
});
