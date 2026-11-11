/**
 * Serves `build/` like a static host would: real files first, `index.html` for every other
 * path (single-page app). Used by the end-to-end tests, including the offline test, which needs
 * the exact files the service worker precaches. `vite preview` does not serve `index.html`.
 *
 * Usage: tsx scripts/serve-build.ts [port]   (default 4173)
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../build/', import.meta.url));
const PORT = Number(process.argv[2] ?? 4173);
const TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.webmanifest': 'application/manifest+json',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2'
};

async function isFile(path: string) {
	try {
		return (await stat(path)).isFile();
	} catch {
		return false;
	}
}

createServer(async (req, res) => {
	const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
	let file = normalize(join(ROOT, pathname));
	if (!file.startsWith(ROOT) || !(await isFile(file))) file = join(ROOT, 'index.html');
	res.writeHead(200, {
		'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
		'cache-control': file.includes('/immutable/')
			? 'public, max-age=31536000, immutable'
			: 'no-cache'
	});
	createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`build/ on http://localhost:${PORT}`));
