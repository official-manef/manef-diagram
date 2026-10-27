import { error, redirect } from '@sveltejs/kit';
import { workspaceSurface } from '$features/workspace';
import { workspaceUrl } from '#lib/config/navigation.js';
import type { LayoutServerLoad } from './$types';
export const load: LayoutServerLoad = ({ params, url }) => {
	if (params.surface && !workspaceSurface(params.surface)) error(404, 'Page not found');
	redirect(308, workspaceUrl(params.surface) + url.search);
};
