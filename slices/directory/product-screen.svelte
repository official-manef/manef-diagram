<script lang="ts">
	import { workspaceUrl } from '$lib/config/navigation';
	import { resolve } from '$app/paths';
	import PublicFrame from './public-frame.svelte';
	import type { Product } from './catalog';

	let { product }: { product: Product } = $props();
</script>

<PublicFrame>
	<main class="public-main">
		<section class="public-section grid2">
			<div>
				<p class="eyebrow">{product.eyebrow}</p>
				<h1 style="margin: 12px 0">{product.headline}</h1>
				<p class="lead">{product.description}</p>
				<div class="row" style="margin-top: 20px">
					{#if product.id === 'diagram'}
						<a class="btn primary" href={resolve('/app')}>Open the public map</a>
					{:else if product.id === 'agent-at-manef'}
						<a class="btn primary" href={product.live} rel="external noreferrer">View source ↗</a>
						<a class="btn" href={workspaceUrl('context')} rel="external">Explore context demo ↗</a>
					{:else}
						<a
							class="btn primary"
							href={workspaceUrl(product.id === 'docs' ? 'developers' : product.id)}
							rel="external">Open demo ↗</a
						>
					{/if}
					{#if product.live && product.id !== 'agent-at-manef'}
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
