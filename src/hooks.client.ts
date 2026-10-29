import type { HandleClientError } from '@sveltejs/kit/hooks';

export const handleError: HandleClientError = () => ({
	message: 'This page could not be loaded. Reload and try again.'
});
