import type { PageLoad } from './$types';

export const load: PageLoad = () => ({
	meta: {
		title: 'Workspace overview',
		description: 'Browser-local demo counters. Not the public service map.',
		indexable: false
	}
});
