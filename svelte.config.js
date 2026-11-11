import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Single-page app: every route is rendered on the device, works offline (FR-018).
		adapter: adapter({ fallback: 'index.html' })
	}
};

export default config;
