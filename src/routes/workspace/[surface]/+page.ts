import { error } from '@sveltejs/kit';
import { workspaceSurface } from '$features/workspace';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const surface = workspaceSurface(params.surface);
	if (!surface) error(404, 'Page not found');
	return {
		surface: surface.id,
		meta: {
			title: surface.title,
			description: 'Browser-local demo. It does not change the public map.',
			indexable: false
		}
	};
};
