<script lang="ts">
	import { browser } from '$app/environment';
	import { ConvexClient } from 'convex/browser';
	import { setConvexClientContext, setupAuth } from 'convex-svelte';
	import { onDestroy, untrack, type Snippet } from 'svelte';
	import type { Session } from '$lib/server/auth/session';

	let { url, session, children }: { url: string; session: Session | null; children: Snippet } =
		$props();

	// A new owner gets a fresh client, including its query cache and pending auth callbacks.
	const client = untrack(() => new ConvexClient(url, { disabled: !browser }));
	setConvexClientContext(client);
	onDestroy(() => {
		// Auth effects clear their callbacks before the transport closes.
		queueMicrotask(() => {
			client.close().catch(() => console.error('convex_client_cleanup_failed'));
		});
	});
	setupAuth(() => ({
		isLoading: false,
		isAuthenticated: Boolean(session),
		fetchAccessToken: async ({ forceRefreshToken }) => {
			if (!session) return null;
			try {
				const response = await fetch('/auth/token', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						forceRefreshToken,
						expectedTokenIdentifier: session.tokenIdentifier
					}),
					signal: AbortSignal.timeout(15_000)
				});
				if (!response.ok) return null;
				const result: unknown = await response.json();
				return result &&
					typeof result === 'object' &&
					'idToken' in result &&
					typeof result.idToken === 'string'
					? result.idToken
					: null;
			} catch {
				return null;
			}
		}
	}));
</script>

{@render children()}
