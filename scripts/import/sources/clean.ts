/**
 * Text cleanup shared by source adapters (contracts/source-adapter.md, rules 2 and 4).
 *
 * Adapters may only trim whitespace, join broken lines, convert to NFC and remove chord or
 * annotation markup. They never reword or fix spelling.
 */
import type { CreditRole } from '../../../src/lib/domain/schema';
import { normalizeText } from '../../../src/lib/search/normalize';

/** Trim, collapse whitespace (non-breaking spaces included) to one space, NFC. */
export function cleanLine(line: string): string {
	return line.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

// A chord: root (English A–G or French Do…Si), optional accidental, quality, extension, bass.
const ROOT = '(?:[A-G]|Do|Ré|Re|Mi|Fa|Sol|La|Si)';
const ACCIDENTAL = '(?:#|♯|b|♭)?';
const QUALITY = '(?:maj|min|m|M|dim|aug|sus|add|\\+|°|ø)?';
const EXTENSION = '(?:\\d{1,2}|sus[24]|add\\d{1,2}|maj\\d{1,2}|[b#]\\d{1,2})*';
const BASS = `(?:/${ROOT}${ACCIDENTAL})?`;
const CHORD = `${ROOT}${ACCIDENTAL}(?:\\s?${QUALITY})${EXTENSION}${BASS}`;

const INLINE_CHORD = new RegExp(`\\[${CHORD}\\]`, 'gu');
const CHORD_TOKEN = new RegExp(`^${CHORD}$`, 'u');

/** A line made only of chord symbols (at least one), e.g. "G  D/F#  Em" or "Do  Sol/Si". */
function isChordLine(line: string): boolean {
	// "Ré m" (French minor written with a space) is joined before checking each token.
	const tokens = line
		.trim()
		.replace(new RegExp(`(${ROOT}${ACCIDENTAL}) (m|M|min|maj)\\b`, 'gu'), '$1$2')
		.split(/\s+/u)
		.filter(Boolean);
	if (tokens.length === 0) return false;
	if (!tokens.every((t) => CHORD_TOKEN.test(t))) return false;
	// A line that is a single bare French note name ("La", "Si") is more likely a lyric word.
	return !(tokens.length === 1 && BARE_FRENCH_NOTE.test(tokens[0]));
}

const BARE_FRENCH_NOTE = /^(?:Do|Ré|Re|Mi|Fa|Sol|La|Si)$/u;

export type StripResult = { lines: string[]; counts: Record<string, number> };

/** Removes chord markup; returns the remaining lines and how much was removed, by kind. */
export function stripChords(lines: string[]): StripResult {
	const counts: Record<string, number> = {};
	const add = (kind: string, n = 1) => (counts[kind] = (counts[kind] ?? 0) + n);
	const out: string[] = [];
	for (const line of lines) {
		if (isChordLine(line)) {
			add('chord-line');
			continue;
		}
		const inline = line.match(INLINE_CHORD);
		if (inline) {
			add('inline-chord', inline.length);
			out.push(cleanLine(line.replace(INLINE_CHORD, '')));
		} else {
			out.push(line);
		}
	}
	return { lines: out, counts };
}

/** Maps a credit label from a source page to a role; `null` when unknown (reported). */
export function mapCreditRole(label: string): CreditRole | null {
	const words = normalizeText(label);
	if (/\b(paroles?|texte|auteurs?|lyrics|words|ecrit)\b/u.test(words)) return 'lyrics';
	if (/\b(musique|compositeur|compositrice|composition|melodie|music|composer)\b/u.test(words)) {
		return 'music';
	}
	if (/\b(traduction|traducteur|traductrice|adaptation|translation)\b/u.test(words)) {
		return 'translation';
	}
	if (/\b(arrangement|arrangeur|harmonisation|harmonie|arranged)\b/u.test(words)) {
		return 'arrangement';
	}
	return null;
}
