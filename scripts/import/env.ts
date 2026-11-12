/**
 * Local settings for the importer. `.env` (git-ignored) holds HYMNIA_CONTACT, the contact
 * address sent to source sites in the User-Agent (research R3). See `.env.example`.
 */
import { existsSync } from 'node:fs';

export function loadEnv(path = '.env') {
	if (existsSync(path)) process.loadEnvFile(path);
}

export function getContact(): string | undefined {
	const value = process.env.HYMNIA_CONTACT?.trim();
	return value ? value : undefined;
}

export function requireContact(): string {
	const contact = getContact();
	if (!contact) throw new Error('HYMNIA_CONTACT is not set (see .env.example)');
	return contact;
}
