<script lang="ts">
	import { workspaceUrl } from '$lib/config/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import PublicFrame from './public-frame.svelte';
	import McpConnection from './mcp-connection.svelte';
	import { guideSections } from './catalog';

	const requestedSection = $derived(page.url.searchParams.get('section'));
	const section = $derived(
		guideSections.find((item) => item.id === requestedSection)?.id ?? 'start'
	);
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
				<h1>Choose the next tool for your task.</h1>
				<p class="muted">
					Public pages discover products. The ecosystem workspace belongs to MANEF. The public
					service map stays at /app.
				</p>
			{:else if section === 'identity'}
				<h1>Use a configured account for private work.</h1>
				<p class="muted">
					The public map works without an account. Private backend storage needs a configured
					identity provider and backend on this deployment. The workspace demo's identity preview
					does not create that session.
				</p>
				{#if page.data.auth?.enabled}
					<p>
						<a class="btn" href={resolve('/auth/login')} data-sveltekit-reload>Sign in with MANEF</a
						>
					</p>
				{:else}
					<p class="notice">
						Sign-in is not enabled on this deployment. You can still use the public map and export
						JSON.
					</p>
				{/if}
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
				<h1>Make your first architecture map.</h1>
				<p class="muted">
					Start with the public MANEF map, then keep your own edits in a portable JSON file.
				</p>
				<ol class="mapping-steps">
					<li>Open Diagram. Search for a service or choose a node in the map.</li>
					<li>
						Inspect the selected service and its connections. Use filters or focus to narrow the
						view.
					</li>
					<li>
						Edit or import your graph, then export JSON to keep the result. Private backend storage
						has separate setup requirements.
					</li>
				</ol>
				<p><a class="btn primary" href={resolve('/app')}>Open Diagram</a></p>
			{/if}
			{#if section !== 'start'}
				<p>
					<a class="btn" href={workspaceUrl()} rel="external">Explore the sample ecosystem demo ↗</a
					>
				</p>
			{/if}
		</article>
	</main>
</PublicFrame>

<style>
	.mapping-steps {
		list-style: decimal;
		padding-left: 1.4rem;
	}
	.mapping-steps li {
		margin-block: 0.9rem;
		padding-left: 0.25rem;
	}
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
