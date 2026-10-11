import { error } from '@sveltejs/kit';
import { workspaceSurface } from '$features/workspace';
import type { PageLoad } from './$types';
export const load: PageLoad = ({ params }) => {
	const surface = params.surface ? workspaceSurface(params.surface) : undefined;
	if (params.surface && !surface) error(404, 'Page not found');
	return {
		surface: surface?.id ?? 'overview',
		meta: {
			title: surface?.title ?? 'MANEF workspace',
			description: 'Browser-local ecosystem demo hosted by MANEF. No live infrastructure changes.',
			indexable: false
		}
	};
};
