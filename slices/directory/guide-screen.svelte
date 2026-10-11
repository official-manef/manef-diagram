<script lang="ts">
	import { workspaceUrl } from '$lib/config/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PublicFrame from './public-frame.svelte';
	import McpConnection from './mcp-connection.svelte';
	import { guideSections } from './catalog';

	const section = $derived(page.url.searchParams.get('section') || 'start');
</script>

<PublicFrame>
	<main class="public-main public-section guide-layout">
		<nav aria-label="Guide sections">
			{#each guideSections as item (item.id)}
				<p>
					<a
						class="nav-item"
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
					Public pages discover products. The ecosystem workspace belongs to MANEF. The public
					service map stays at /app.
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
				<h1>Connect to the Diagram MCP server</h1>
				<McpConnection />
				<h2>Troubleshooting</h2>
				<p>
					401 means the server token is missing or invalid. 404 means the server is disabled on that
					deployment. 503 means the deployment owner must configure the token. 429 means the request
					limit was reached; wait before retrying.
				</p>
				<p>
					Use POST to this exact endpoint. An optional Origin header must match the deployment's
					public origin. A client that requires OAuth and cannot send a bearer header is not
					compatible with this endpoint.
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
					Start at Products, open Diagram for the public map, then use the MANEF workspace to try
					catalog, routing, and context without publishing any of it.
				</p>
				<p class="muted">
					Ctrl or Cmd K inside the workspace searches pages. Export the demo before you reset it.
				</p>
			{/if}
			<p><a class="btn" href={workspaceUrl()} rel="external">Open MANEF workspace ↗</a></p>
		</article>
	</main>
</PublicFrame>

<style>
	.guide-layout {
		display: grid;
		grid-template-columns: 200px minmax(0, 1fr);
		gap: 40px;
		align-items: start;
	}
	@media (max-width: 900px) {
		nav {
			display: flex;
			flex-wrap: wrap;
			gap: 4px;
		}
		.guide-layout {
			grid-template-columns: minmax(0, 1fr);
			gap: 24px;
		}
	}
</style>
