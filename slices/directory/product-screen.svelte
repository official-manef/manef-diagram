<script lang="ts">
	import { resolve } from '$app/paths';
	import PublicFrame from './public-frame.svelte';
	import type { Product } from './catalog';

	let { product }: { product: Product } = $props();
	const demo = $derived(
		product.id === 'diagram'
			? resolve('/app')
			: resolve('/workspace/[surface]', {
					surface: product.id === 'docs' ? 'developers' : product.id
				})
	);
</script>

<PublicFrame>
	<main class="public-main">
		<section class="public-section grid2">
			<div>
				<p class="eyebrow">{product.eyebrow}</p>
				<h1 style="margin: 12px 0">{product.headline}</h1>
				<p class="lead">{product.description}</p>
				<div class="row" style="margin-top: 20px">
					<a class="btn primary" href={demo}
						>{product.id === 'diagram' ? 'Open the public map' : 'Open demo'}</a
					>
					{#if product.live}
						<a class="btn" href={product.live} rel="external noreferrer">Known link</a>
					{/if}
				</div>
			</div>
			<aside class="card stack">
				<p class="pill">{product.status}</p>
				<p><strong>{product.domain}</strong></p>
				<ul>
					{#each product.features as feature (feature)}
						<li>{feature}</li>
					{/each}
				</ul>
			</aside>
		</section>
		<section class="public-section">
			<h2>What is actually true</h2>
			<p class="notice" style="margin-top: 12px">{product.truth}</p>
		</section>
	</main>
</PublicFrame>
