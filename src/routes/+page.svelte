<script lang="ts">
	import { appConfig } from '$lib/config/app';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { resolve } from '$app/paths';
	import { defaultGraph } from '$features/architecture-inventory';

	const session = $derived(page.data.auth?.session);
	const services = defaultGraph.nodes;
</script>

<svelte:head>
	<title>{appConfig.name} — {appConfig.landing.title}</title>
</svelte:head>

<main class="landing">
	<div class="hero">
		<div class="badge">{appConfig.landing.badge}</div>
		<h1>{appConfig.landing.title}</h1>
		<p class="lead">{appConfig.landing.description}</p>
		<div class="actions">
			<Button size="lg" href={resolve('/app')}>Open diagram</Button>
			{#if session}
				<span class="signed-in">Signed in as {session.email ?? session.subject}</span>
				<form method="POST" action="/auth/logout">
					<Button variant="outline" size="lg" type="submit">Sign out</Button>
				</form>
			{:else}
				<Button variant="outline" size="lg" href="/auth/login" data-sveltekit-reload>
					Sign in with MANEF
				</Button>
			{/if}
		</div>
	</div>

	<section class="preview" aria-label="Public services">
		<div class="preview-copy">
			<h2>Public services</h2>
			<p>
				{services.length} services are on the map. Selecting one opens it with its direct neighbors.
			</p>
		</div>
		<ol>
			{#each services as node (node.id)}
				<li>
					<Button class="service-link" variant="outline" href={`/app?seed=${node.id}&trace=direct`}>
						<strong>{node.label}</strong>
						<span>{node.subtitle}</span>
						<em data-status={node.status ?? 'active'}>{node.status ?? 'active'}</em>
					</Button>
				</li>
			{/each}
		</ol>
	</section>

	<section class="cards">
		<div class="card">
			<h2>Labeled connections</h2>
			<p>
				Each line names the relationship, such as context graph, infrastructure, or private
				operations.
			</p>
		</div>
		<div class="card">
			<h2>Same map on a phone</h2>
			<p>Narrow screens show the full service names in a list instead of a shrunken canvas.</p>
		</div>
		<div class="card">
			<h2>MCP needs a token</h2>
			<p>Agents can query the public map at /api/mcp/server. The route rejects anonymous calls.</p>
		</div>
	</section>

	<section class="closer">
		<h2>The diagram is the product</h2>
		<p>This page introduces the services. The labeled map lives at /app.</p>
		<Button href={resolve('/app')}>Open the map</Button>
	</section>
</main>

<style>
	.landing {
		display: flex;
		min-height: 100dvh;
		flex-direction: column;
		gap: 2.5rem;
		margin: 0 auto;
		max-width: 68rem;
		padding: 2.5rem 1.25rem 3rem;
		background: var(--background);
		color: var(--foreground);
	}
	.hero {
		display: grid;
		gap: 1rem;
		max-width: 40rem;
	}
	.badge {
		justify-self: start;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--muted);
		padding: 0.35rem 0.9rem;
		font-size: 0.78rem;
		color: var(--muted-foreground);
	}
	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3.2rem);
		line-height: 1.1;
		letter-spacing: -0.02em;
	}
	.lead,
	.preview-copy p,
	.card p {
		margin: 0;
		color: var(--muted-foreground);
		font-size: 1rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}
	.signed-in {
		font-size: 0.85rem;
		color: var(--muted-foreground);
	}
	.preview {
		display: grid;
		gap: 1rem;
	}
	.preview-copy h2,
	.card h2 {
		margin: 0 0 0.35rem;
		font-size: 1rem;
	}
	.preview ol {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 0.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.preview :global(.service-link) {
		display: grid;
		height: 100%;
		align-content: start;
		justify-items: start;
		gap: 0.2rem;
		white-space: normal;
		text-align: left;
	}
	.preview span {
		color: var(--muted-foreground);
		font-size: 0.85rem;
		font-weight: 400;
	}
	.preview em {
		justify-self: start;
		margin-top: 0.35rem;
		border-radius: 999px;
		background: var(--muted);
		padding: 0.1rem 0.45rem;
		font-size: 0.72rem;
		font-style: normal;
	}
	.preview em[data-status='private'] {
		color: var(--destructive);
	}
	.cards {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
	}
	.card {
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--card);
		padding: 1rem 1.1rem;
	}
	@media (min-width: 800px) {
		.cards {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.closer {
		display: grid;
		gap: 0.65rem;
		margin-top: auto;
		border-top: 1px solid var(--border);
		padding-top: 1.5rem;
	}
	.closer h2 {
		margin: 0;
		font-size: 1rem;
	}
</style>
