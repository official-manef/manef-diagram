import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** `/diagram` is a dead alias of the canonical canvas. Preserve portable query state. */
export const GET: RequestHandler = ({ url }) => {
	redirect(307, `/app${url.search}`);
};
