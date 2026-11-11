/** One search worker for the whole visit, started on first use. */
import { base } from '$app/paths';
import { createSearchClient, type SearchClient } from './client';

let client: SearchClient | undefined;

export function getSearchClient(): SearchClient {
	client ??= createSearchClient(base);
	return client;
}
