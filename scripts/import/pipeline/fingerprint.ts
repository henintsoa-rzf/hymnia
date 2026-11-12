/**
 * Fingerprint of a hymn's text as extracted from its source (research R6).
 *
 * It ignores only what extraction is allowed to change (FR-004): whitespace (including
 * non-breaking spaces) and the Unicode form. Every visible change at the source — a word,
 * punctuation, case, an accent, a section type or verse number — changes the fingerprint, so
 * it is reviewed as a pending change instead of being missed.
 *
 * (The search normalisation `normalizeText` is deliberately not used here: it drops
 * punctuation, accents and case, so a source correcting "Eternel" to "Éternel" would go
 * unnoticed.)
 */
import { createHash } from 'node:crypto';
import type { Section } from '../../../src/lib/domain/schema';

export type FingerprintInput = { title: string; sections: Section[] };

/** NFC, every run of whitespace as one space, trimmed. */
export function canonicalText(text: string): string {
	return text.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

export function fingerprint({ title, sections }: FingerprintInput): string {
	const canonical = [
		canonicalText(title),
		sections.map((s) => [s.type, s.number, s.lines.map(canonicalText)])
	];
	return 'sha256:' + createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
