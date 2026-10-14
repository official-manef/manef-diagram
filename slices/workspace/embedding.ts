import { siteLinks } from '$lib/config/navigation';

const localHosts = new Set(['localhost', '127.0.0.1']);
const ownerOrigins = [siteLinks.ecosystemOrigin, 'https://staging.manef.dev'];

export function workspaceFrameAncestors(development: boolean) {
	return [
		"'self'",
		...ownerOrigins,
		...(development ? ['http://localhost:*', 'http://127.0.0.1:*'] : [])
	].join(' ');
}

function isLocal(url: URL) {
	return ['http:', 'https:'].includes(url.protocol) && localHosts.has(url.hostname);
}

/** Only the MANEF owners, or a loopback host paired with a local Diagram, receive navigation. */
export function workspaceParentOrigin(referrer: string, diagramOrigin: string): string | null {
	if (!referrer) return siteLinks.ecosystemOrigin;
	try {
		const parent = new URL(referrer);
		if (parent.username || parent.password) return null;
		if (ownerOrigins.includes(parent.origin)) return parent.origin;
		return isLocal(parent) && isLocal(new URL(diagramOrigin)) ? parent.origin : null;
	} catch {
		return null;
	}
}

/** A validated host announcement survives iframe reloads that replace document.referrer. */
export function workspaceHostOrigin(
	event: { origin: string; source: unknown; data: unknown },
	parent: unknown,
	diagramOrigin: string
): string | null {
	if (
		!parent ||
		event.source !== parent ||
		!event.data ||
		typeof event.data !== 'object' ||
		Array.isArray(event.data) ||
		(event.data as { type?: unknown }).type !== 'manef-workspace-host'
	)
		return null;
	return workspaceParentOrigin(event.origin, diagramOrigin) === event.origin ? event.origin : null;
}
