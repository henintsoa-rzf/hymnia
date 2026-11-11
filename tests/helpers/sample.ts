import { fileURLToPath } from 'node:url';
import { buildData } from '../../scripts/build-data';
import type { Catalog } from '../../src/lib/domain/schema';

/** Build the real sample collection in content/ (in memory, nothing written). */
export async function loadSample(): Promise<{ catalog: Catalog; indexJson: string }> {
	const dir = fileURLToPath(new URL('../../content', import.meta.url));
	const { errors, catalog, indexJson } = await buildData(dir);
	if (errors.length || !catalog || !indexJson) throw new Error(errors.join('\n'));
	return { catalog, indexJson };
}
