<script lang="ts">
	import { resolve } from '$app/paths';
	import PublicFrame from './public-frame.svelte';
	import { principles, products } from './data';
</script>

<PublicFrame>
	<main class="public-main">
		<section class="hero">
			<div>
				<p class="eyebrow">Connected ecosystem</p>
				<h1>One studio. <span>Separate products.</span></h1>
				<p class="lead">
					Find what is already deployed, what is only proposed, and the public service map. The demo
					workspace never becomes that map.
				</p>
				<div class="row" style="margin-top: 22px">
					<a class="btn lime" href={resolve('/products')}>Explore products</a>
					<a class="btn" href={resolve('/workspace')}>Open demo workspace</a>
				</div>
			</div>
			<div class="hero-canvas" aria-hidden="true">
				<div class="hero-node one"><strong>MANEF</strong><small>Public studio</small></div>
				<div class="hero-node two"><strong>Diagram</strong><small>diagram.manef.dev</small></div>
				<div class="hero-node three"><strong>MSO</strong><small>mso.manef.dev</small></div>
			</div>
		</section>
		<section class="public-section">
			<p class="eyebrow">Eight surfaces</p>
			<h2 style="margin: 8px 0 18px">Shipped, sourced, or only proposed.</h2>
			<div class="grid4">
				{#each products as product (product.id)}
					<a class="card product-card" href={resolve('/products/[slug]', { slug: product.id })}>
						<span class="mark {product.color}">{product.name.slice(0, 1)}</span>
						<div>
							<h3>{product.name}</h3>
							<p>{product.description}</p>
						</div>
						<span class="pill">{product.status}</span>
					</a>
				{/each}
			</div>
		</section>
		<section class="public-section">
			<div class="grid4">
				{#each principles as [number, title, body] (number)}
					<article>
						<p class="eyebrow">{number}</p>
						<h3 style="margin: 10px 0">{title}</h3>
						<p class="muted">{body}</p>
					</article>
				{/each}
			</div>
		</section>
	</main>
</PublicFrame>
