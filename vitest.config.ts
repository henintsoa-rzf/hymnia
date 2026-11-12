import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const lib = fileURLToPath(new URL('./src/lib', import.meta.url));

export default defineConfig({
	resolve: { alias: { $lib: lib } },
	test: {
		projects: [
			{
				resolve: { alias: { $lib: lib } },
				test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] }
			},
			{
				resolve: { alias: { $lib: lib } },
				test: { name: 'queries', include: ['tests/queries/**/*.test.ts'] }
			},
			{
				resolve: { alias: { $lib: lib } },
				test: { name: 'perf', include: ['tests/perf/**/*.test.ts'], testTimeout: 120_000 }
			},
			{
				resolve: { alias: { $lib: lib } },
				test: { name: 'import', include: ['tests/import/**/*.test.ts'] }
			}
		]
	}
});
