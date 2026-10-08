<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PublicFrame from './public-frame.svelte';
	import { guideSections } from './data';

	const section = $derived(page.url.searchParams.get('section') || 'start');
</script>

<PublicFrame>
	<main class="public-main public-section grid2">
		<nav aria-label="Guide sections">
			{#each guideSections as item (item.id)}
				<p>
					<a
						href={resolve(`/guide?section=${item.id}`)}
						aria-current={section === item.id ? 'page' : undefined}>{item.title}</a
					>
				</p>
			{/each}
		</nav>
		<article class="stack">
			{#if section === 'navigation'}
				<h1>A home, not a maze of subdomains.</h1>
				<p class="muted">
					Public pages discover products. The workspace is a demo shell. The public service map
					stays at /app.
				</p>
			{:else if section === 'identity'}
				<h1>Sign-in is not this switch.</h1>
				<p class="muted">
					MANEF sign-in uses WorkOS when it is configured. The demo workspace has a simulated
					sign-in that does not create a session.
				</p>
				<p>
					<a class="btn" href={resolve('/auth/login')} data-sveltekit-reload>Sign in with MANEF</a>
				</p>
			{:else if section === 'mcp'}
				<h1>Ten tools in source. One local playground.</h1>
				<p class="muted">
					The production route is POST /api/mcp/server and it rejects anonymous calls. The workspace
					playground returns a local simulation and does not send the token.
				</p>
			{:else if section === 'catalog'}
				<h1>Metadata is not an installer.</h1>
				<p class="muted">
					Hermes, OpenClaw, and 9Router are managed ids. n8n connects an existing instance. Install
					in the demo only changes this browser.
				</p>
			{:else}
				<h1>Open the map. Then the demo.</h1>
				<p class="muted">
					Start at Products, open Diagram for the public map, then use the workspace to try catalog,
					routing, and context without publishing any of it.
				</p>
				<p class="muted">
					Ctrl or Cmd K inside the workspace searches pages. Export the demo before you reset it.
				</p>
			{/if}
		</article>
	</main>
</PublicFrame>
