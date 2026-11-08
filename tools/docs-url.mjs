/**
 * Replaces the STIPEND_URL placeholder with the real deployment URL in the docs.
 * The name stays where it is an environment-variable key; the value becomes real.
 */
import fs from 'node:fs';
import path from 'node:path';

const LIVE = 'https://stipend-delta.vercel.app';

const files = [
  ...fs.readdirSync('docs7').filter((f) => f.endsWith('.mdx')).map((f) => path.join('docs7', f)),
  'app/docs/content.tsx',
];

const replacements = [
  ['STIPEND_URL=STIPEND_URL', `STIPEND_URL=${LIVE}`],
  ['"STIPEND_URL": "STIPEND_URL"', `"STIPEND_URL": "${LIVE}"`],
  ['POST STIPEND_URL/', `POST ${LIVE}/`],
  ['Go to `STIPEND_URL`', `Go to ${LIVE}`],
  ['Go to STIPEND_URL', `Go to ${LIVE}`],
  ['except to `STIPEND_URL`', `except to the deployment URL`],
  ['except to STIPEND_URL', `except to the deployment URL`],
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let text = fs.readFileSync(file, 'utf8');
  let changed = 0;
  for (const [from, to] of replacements) {
    if (text.includes(from)) {
      changed += text.split(from).length - 1;
      text = text.split(from).join(to);
    }
  }
  if (changed > 0) {
    fs.writeFileSync(file, text, 'utf8');
    console.log(`${file}: ${changed} replacement(s)`);
  }
}

// The index page should name the URL outright, not describe a placeholder.
const indexFile = 'docs7/index.mdx';
if (fs.existsSync(indexFile)) {
  let text = fs.readFileSync(indexFile, 'utf8');
  text = text.replace(
    /Throughout these docs, `STIPEND_URL` means the console URL you were given — for example\n`STIPEND_URL`\./,
    `Throughout these docs, the base URL is **${LIVE}**.\nWhere a config example shows \`STIPEND_URL\`, use that address.`,
  );
  fs.writeFileSync(indexFile, text, 'utf8');
  console.log('index.mdx: base URL stated outright');
}
