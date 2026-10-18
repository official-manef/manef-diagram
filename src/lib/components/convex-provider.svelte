<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Session } from '$lib/server/auth/session';
	import ConvexSession from './convex-session.svelte';

	let { url, session, children }: { url: string; session: Session | null; children: Snippet } =
		$props();
</script>

{#key `${url}|${session?.tokenIdentifier ?? ''}`}
	<ConvexSession {url} {session}>
		{@render children()}
	</ConvexSession>
{/key}
