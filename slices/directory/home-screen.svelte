<script lang="ts">
	import { resolve } from '$app/paths';
	import PublicFrame from './public-frame.svelte';
	import McpConnection from './mcp-connection.svelte';
	import { products } from './catalog';
	const diagram = products.find((product) => product.id === 'diagram')!;
</script>

<PublicFrame>
	<main class="public-main">
		<section class="hero">
			<div>
				<p class="eyebrow">MANEF / Architecture workspace</p>
				<h1>Manef Diagram</h1>
				<p class="lead">
					Map services, explore dependencies, and open component diagrams in one interactive
					workspace. Start with the public MANEF map, then edit or import your own graph.
				</p>
				<div class="row" style="margin-top: 22px">
					<a class="btn primary" href={resolve('app')}>Start mapping</a>
					<a class="btn" href={resolve('guide')}>Read the guide</a>
				</div>
			</div>
		</section>
		<section class="public-section">
			<p class="eyebrow">Inside Diagram</p>
			<h2>Explore, edit, and share your architecture.</h2>
			<div class="grid4">
				{#each diagram.features as feature (feature)}
					<article class="card"><h3>{feature}</h3></article>
				{/each}
			</div>
		</section>
		<section class="public-section" id="mcp">
			<p class="eyebrow">For AI assistants and developers</p>
			<h2>Connect Diagram through MCP</h2>
			<McpConnection />
			<p style="margin-top: 18px">
				<a class="btn" href={resolve('guide?section=mcp')}>Read the MCP guide</a>
			</p>
		</section>
		<section class="public-section">
			<h2>Start with the public map</h2>
			<p class="lead">
				Open the app, select a service to inspect its connections, then use search or tags to focus
				the view. Export JSON to keep your edits or share a portable view. Backend storage requires
				a configured account; the public map works without signing in.
			</p>
			<p style="margin-top: 18px">
				Looking for MSO and the other MANEF products? <a href="https://manef.dev/#products"
					>Explore the MANEF ecosystem ↗</a
				>.
			</p>
		</section>
	</main>
</PublicFrame>
