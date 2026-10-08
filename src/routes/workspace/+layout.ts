import type { LayoutLoad } from './$types';

export const load: LayoutLoad = () => ({
	meta: {
		title: 'Demo workspace',
		description: 'Browser-local MANEF ecosystem simulation. It does not change the public map.',
		indexable: false
	}
});
