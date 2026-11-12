import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: true,
	reporter: 'list',
	use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
	projects: [
		{ name: 'android', use: { ...devices['Pixel 7'] } },
		{ name: 'iphone', use: { ...devices['iPhone 13'] } }
	],
	webServer: {
		// Built from the sample hymnals (tests/fixtures/sample-content), whatever is in content/
		// or .env. Run `npm run data` afterwards to get the real collection back in static/data.
		command:
			'HYMNIA_PERSONAL_USE=0 tsx scripts/build-data.ts tests/fixtures/sample-content && ' +
			'vite build && tsx scripts/serve-build.ts 4173',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	}
});
