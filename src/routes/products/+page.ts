import type { PageLoad } from './$types';

export const load: PageLoad = () => ({
	meta: {
		title: 'Products',
		description: 'MANEF products and proposed surfaces, labeled by what is actually shipped.'
	}
});
