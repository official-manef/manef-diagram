import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

const titles: Record<string, string> = {
	overview: 'Workspace overview',
	mso: 'MSO demo',
	diagram: 'Diagram demo',
	context: 'Context demo',
	registry: 'Catalog demo',
	models: 'Models demo',
	connectors: 'Connectors demo',
	ops: 'Operations demo',
	developers: 'Developer playground',
	labs: 'Labs',
	settings: 'Demo settings'
};

export const load: PageLoad = ({ params }) => {
	const title = titles[params.surface];
	if (!title) error(404, 'Page not found');
	return {
		surface: params.surface,
		meta: {
			title,
			description: 'Browser-local demo. It does not change the public map.',
			indexable: false
		}
	};
};
