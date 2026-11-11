import { withPwa } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';
import svelteConfig from './svelte.config.js';

// Theme colours and icons from design/decisions.md §11.
const PAPER = '#faf8f4';

export default defineConfig({
	plugins: [
		// withPwa runs the SvelteKit plugin itself, with the options from svelte.config.js.
		withPwa(
			{ preprocess: svelteConfig.preprocess, ...svelteConfig.kit },
			{
				// A new version (app or hymn data) waits for the user: "Recharger" (FR-018).
				registerType: 'prompt',
				kit: { adapterFallback: 'index.html', spa: true },
				manifest: {
					name: 'Hymnia',
					short_name: 'Hymnia',
					description:
						'Recueil de chants et hymnes chrétiens : recherche par numéro, titre ou paroles.',
					lang: 'fr',
					start_url: '/',
					scope: '/',
					display: 'standalone',
					background_color: PAPER,
					theme_color: PAPER,
					icons: [
						{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
						{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
						{
							src: 'icons/icon-512-maskable.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'maskable'
						}
					]
				},
				// The search index of a large collection is several MB.
				maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
				generateSW: {
					// App, fonts (Latin only), icons and the hashed hymn data: all of it works offline.
					globPatterns: ['client/**/*.{js,css,png,svg,woff2,webmanifest,json}'],
					globIgnores: ['**/*cyrillic*', '**/*greek*', '**/*vietnamese*'],
					// Nothing is prerendered (single-page app): the plugin's default "prerendered/"
					// pattern matches no file. The fallback page is added through `kit.spa`.
					globStrict: false
				}
			}
		)
	]
});
