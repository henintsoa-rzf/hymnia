import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { PageLoad } from './$types';

/** An unknown settings section opens the menu (feature 016, edge case « unknown address »). */
export const load: PageLoad = () => {
	redirect(307, resolve('/reglages'));
};
