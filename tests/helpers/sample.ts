import { fileURLToPath } from 'node:url';
import { buildData } from '../../scripts/build-data';
import type { Catalog } from '../../src/lib/domain/schema';

/** The sample hymnals of feature 001 (CE, HE), moved out of content/ by feature 002 (T062). */
export const SAMPLE_CONTENT = fileURLToPath(new URL('../fixtures/sample-content', import.meta.url));

/** Build the sample collection (in memory, nothing written; unconfirmed hymns left out). */
export async function loadSample(): Promise<{ catalog: Catalog; indexJson: string }> {
	const { errors, catalog, indexJson } = await buildData(SAMPLE_CONTENT);
	if (errors.length || !catalog || !indexJson) throw new Error(errors.join('\n'));
	return { catalog, indexJson };
}
