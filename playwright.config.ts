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
		command: 'npm run build && tsx scripts/serve-build.ts 4173',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000
	}
});
