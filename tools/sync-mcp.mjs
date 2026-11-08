/**
 * Copies the MCP server into public/ so a hosted deployment can serve it.
 *
 * The console tells people to download the server and register it with their
 * agent. A path on my laptop is useless to them, so the file has to live at a
 * URL. public/ is served as-is by Next, and this runs before every build so the
 * published copy cannot drift from the source.
 */
import fs from 'node:fs';
import path from 'node:path';

const source = path.join(process.cwd(), 'mcp', 'stipend-mcp.mjs');
const target = path.join(process.cwd(), 'public', 'stipend-mcp.mjs');

if (!fs.existsSync(source)) {
  console.error(`missing ${source}`);
  process.exit(1);
}

const body = fs.readFileSync(source, 'utf8');
if (!body.includes('stipend') || body.length < 2000) {
  console.error('refusing to publish: the file does not look like the MCP server');
  process.exit(1);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, body);
console.log(`published mcp server -> public/stipend-mcp.mjs (${body.length} bytes)`);
