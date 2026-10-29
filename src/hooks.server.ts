import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { appConfig } from '#lib/config/app.js';
import { dev } from '$app/env';
import { workspaceFrameAncestors } from '$features/workspace';

if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(appConfig.locale)) {
	throw new Error('Set a valid language tag in appConfig.locale.');
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.requestId = crypto.randomUUID();
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%app.locale%', appConfig.locale)
	});
	response.headers.set('X-Content-Type-Options', 'nosniff');
	const embedded = event.route.id === '/embed/workspace/[[surface]]';
	// The public demo may be framed by MANEF; private pages keep the existing policy.
	if (!embedded) response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	if (!response.headers.has('Content-Security-Policy'))
		response.headers.set(
			'Content-Security-Policy',
			embedded
				? `frame-ancestors ${workspaceFrameAncestors(dev)}`
				: "frame-ancestors 'self' https://*.manef.dev https://mso.rahmanef.com"
		);
	if (!response.headers.has('Referrer-Policy'))
		response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Request-Id', event.locals.requestId);
	if (event.url.pathname.startsWith('/api/') || event.url.pathname.startsWith('/auth/')) {
		response.headers.set('Cache-Control', 'no-store');
	}
	return response;
};

// SvelteKit 3 passes a discriminated CaughtError: framework, app and validation errors carry
// a status, unknown errors are always 500. The status used to arrive as a top-level argument.
// A thrown App.Error object also carries the status at runtime, which its type does not declare.
function caughtStatus(caught: Parameters<HandleServerError>[0]): number {
	if (caught.kind === 'unknown') return 500;
	return (caught.error as { status: number }).status;
}

export const handleError: HandleServerError = (caught) => {
	const { event } = caught;
	const status = caughtStatus(caught);
	const id = event.locals.requestId ?? crypto.randomUUID();
	// Provider exceptions may contain credentials or request payloads. Log only correlation data.
	console.error('request_failed', {
		id,
		status,
		method: event.request.method,
		route: event.route.id
	});
	// An error thrown with error(404, 'App not found') carries a reviewed message that the page
	// shows. Framework messages and unknown errors keep this app's own copy instead.
	const message =
		caught.kind === 'app'
			? caught.error.message
			: status === 404
				? 'Page not found.'
				: 'Something went wrong. Please try again.';
	return { message, id };
};
